import { httpRequest } from "../../core/network/httpClient.js";
import { ProfileManager } from "../../core/profile/profileManager.js";
import { LocalStore } from "../../core/storage/localStore.js";
import { addonRepository } from "../repository/addonRepository.js";

let addonChangeUnsubscribe = null;

const NUVIO_SERVICE_KEY = "nuvioServiceConnections";

function profile() {
  return String(ProfileManager.getActiveProfileId() || "1");
}

function getConnections() {
  const envelope = LocalStore.get(NUVIO_SERVICE_KEY, { __profileScoped: true, version: 1, profiles: {} });
  const pid = profile();
  return envelope.profiles[pid] || [];
}

function setConnections(connections) {
  const envelope = LocalStore.get(NUVIO_SERVICE_KEY, { __profileScoped: true, version: 1, profiles: {} });
  const pid = profile();
  envelope.profiles[pid] = connections;
  LocalStore.set(NUVIO_SERVICE_KEY, envelope);
}

function buildBaseUrl(connection) {
  return `http://${connection.address}:${connection.port || 11471}`;
}

export const NuvioServiceRepository = {
  connections() {
    return getConnections();
  },

  connection(id) {
    return this.connections().find((entry) => entry.id === id);
  },

  async connect({ address, port = 11471, connectionId = null }) {
    const pid = profile();
    const baseUrl = `http://${address}:${port}`;

    // Streaming server URL - will be set after health check
    let streamingServerUrl = null;

    // Test connection and get addons
    try {
      console.log('[NuvioServiceRepository] Connecting to:', baseUrl);
      const addonsResponse = await httpRequest(`${baseUrl}/addon/installed`, {
        includeSessionAuth: false,
        timeoutMs: 3
      });
      console.log('[NuvioServiceRepository] addon/installed response:', addonsResponse);

      if (!addonsResponse || addonsResponse.error) {
        console.log('[NuvioServiceRepository] No addons response or error');
        throw new Error("nuvio_service_unreachable");
      }

      // Check if service is healthy
      const healthResponse = await httpRequest(`${baseUrl}/health`, {
        includeSessionAuth: false,
        timeoutMs: 1
      });
      // console.log('[NuvioServiceRepository] health response:', healthResponse);

      if (!healthResponse || healthResponse.status !== "ok") {
        console.log('[NuvioServiceRepository] Health check failed');
        throw new Error("nuvio_service_unhealthy");
      }

      // Get streaming server URL from settings
      try {
        const settingsResponse = await httpRequest(`${baseUrl}/settings`, {
          includeSessionAuth: false,
          timeoutMs: 3
        });
        console.log('[NuvioServiceRepository] settings response:', settingsResponse);
        if (settingsResponse?.streaming_server_url) {
          streamingServerUrl = settingsResponse.streaming_server_url;
        }
      } catch (e) {
        console.log('[NuvioServiceRepository] settings request failed:', e);
      }
      // Fallback: derive streaming server URL from connection address (same host, port 11470)
      if (!streamingServerUrl || streamingServerUrl.includes('localhost')) {
        const host = address.includes(':') ? address.split(':')[0] : address;
        streamingServerUrl = `http://${host}:11470`;
        console.log('[NuvioServiceRepository] Derived streaming server URL:', streamingServerUrl);
      }
    } catch (error) {
      console.log('[NuvioServiceRepository] Caught error:', error);
      throw new Error("nuvio_service_unreachable");
    }

    console.log('[NuvioServiceRepository] Past try-catch, creating connection...');
    console.log('[NuvioServiceRepository] crypto.randomUUID:', typeof globalThis.crypto.randomUUID);
    const id = connectionId || globalThis.crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    console.log('[NuvioServiceRepository] Generated ID:', id, 'connectionId:', connectionId);
    console.log('[NuvioServiceRepository] About to create connection object...');
    try {
      const connection = {
        id,
        address,
        port,
        name: "Nuvio Service",
        enabled: true,
        createdAt: Date.now(),
        streamingServerUrl,
        cacheSizeMB: 100 // Default 2GB
      };
      console.log('[NuvioServiceRepository] Connection object created:', connection.id);
      console.log('[NuvioServiceRepository] Getting connections...');
      const connections = getConnections();
      console.log('[NuvioServiceRepository] Current connections:', connections.length);
      console.log('[NuvioServiceRepository] Setting connections...');
      setConnections([...connections.filter((c) => c.id !== id), connection]);
      console.log('[NuvioServiceRepository] Connections set');
      this.changed();
      console.log('[NuvioServiceRepository] Connection saved, ID:', id);

      // Sync installed addons from NuvioTVSmart to NuvioService
      console.log('[NuvioServiceRepository] Calling syncAddons...');
      await this.syncAddons(connection);
      console.log('[NuvioServiceRepository] syncAddons done');
      this.startAddonChangeListener();

      return connection;
    } catch (e) {
      console.error('[NuvioServiceRepository] ERROR in connection creation:', e);
      throw e;
    }
  },

  startAddonChangeListener() {
    if (addonChangeUnsubscribe) return;
    addonChangeUnsubscribe = addonRepository.onInstalledAddonsChanged(async (reason) => {
      const connections = this.connections();
      if (!connections.length) return;
      // Sync to all connected NuvioService instances
      for (const connection of connections) {
        if (connection.enabled) {
          await this.syncAddons(connection);
        }
      }
    });
  },

  stopAddonChangeListener() {
    if (addonChangeUnsubscribe) {
      addonChangeUnsubscribe();
      addonChangeUnsubscribe = null;
    }
  },

  async syncAddons(connection) {
    const baseUrl = buildBaseUrl(connection);
    try {
      const installedAddons = await addonRepository.getInstalledAddons({ includeMediaServers: false });
      console.log('[NuvioServiceRepository] syncAddons: found', installedAddons.length, 'installed addons');
      installedAddons.forEach((a, i) => console.log(`[NuvioServiceRepository] syncAddons: addon[${i}] enabled=${a.enabled} hasManifest=${!!a.manifest} name=${a.name || a.manifest?.name} baseUrl=${a.baseUrl} manifestUrl=${a.manifestUrl}`));
      
      const externalAddons = installedAddons
        .filter((a) => (a.enabled !== false) && (a.manifest || a.baseUrl))
        .map((addon) => {
          // Extract base manifest URL (strip query params) for service to fetch manifest
          let manifestUrl = addon.manifestUrl || addon.baseUrl;
          if (manifestUrl && !manifestUrl.endsWith('.json')) {
            // Torrentio custom URLs have query params - extract base manifest URL
            try {
              const url = new URL(manifestUrl);
              // Use only origin + /manifest.json (discard path and query)
              manifestUrl = `${url.origin}/manifest.json`;
            } catch (e) {
              // fallback: append manifest.json
              if (!manifestUrl.endsWith('/')) manifestUrl += '/';
              manifestUrl += 'manifest.json';
            }
          }
          return {
            manifestUrl,
            manifest: addon.manifest,
            enabled: addon.enabled !== false,
            name: addon.name || addon.manifest?.name
          };
        });

      console.log('[NuvioServiceRepository] syncAddons: sending', externalAddons.length, 'addons to service');
      externalAddons.forEach((a, i) => console.log(`[NuvioServiceRepository] syncAddons: addon[${i}] ${a.name} -> ${a.manifestUrl}`));
      
      if (externalAddons.length === 0) return;

      await httpRequest(`${baseUrl}/addon/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addons: externalAddons }),
        includeSessionAuth: false,
        timeoutMs: 30000
      });
      console.log('[NuvioServiceRepository] syncAddons: sync completed');
    } catch (error) {
      console.warn('[NuvioServiceRepository] Failed to sync addons:', error);
    }
  },

  async refreshAddons(connection) {
    const baseUrl = buildBaseUrl(connection);
    try {
      const addonsResponse = await httpRequest(`${baseUrl}/addon/installed`, {
        includeSessionAuth: false,
        timeoutMs: 10000
      });
      return addonsResponse?.addons || [];
    } catch (_) {
      return [];
    }
  },

  async installAddon(connection, manifestUrl) {
    const baseUrl = buildBaseUrl(connection);
    try {
      const result = await httpRequest(`${baseUrl}/addon/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manifest_url: manifestUrl }),
        includeSessionAuth: false,
        timeoutMs: 30000
      });
      return result;
    } catch (error) {
      return { error: error?.message || "Failed to install addon" };
    }
  },

  async removeAddon(connection, manifestUrl) {
    const baseUrl = buildBaseUrl(connection);
    try {
      await httpRequest(`${baseUrl}/addon/${encodeURIComponent(manifestUrl)}`, {
        method: "DELETE",
        includeSessionAuth: false,
        timeoutMs: 10000
      });
      return { success: true };
    } catch (error) {
      return { error: error?.message || "Failed to remove addon" };
    }
  },

  async syncAllEnabledAddons(connection) {
    await this.syncAddons(connection);
  },

  async getManifest(connection) {
    const addons = await this.refreshAddons(connection);
    if (!addons.length) return null;

    // Build aggregated manifest from installed addons
    const allCatalogs = [];
    const allResources = new Map();

    for (const addon of addons) {
      if (!addon.enabled || !addon.manifest) continue;
      const manifest = addon.manifest;

      if (Array.isArray(manifest.catalogs)) {
        for (const catalog of manifest.catalogs) {
          allCatalogs.push({
            ...catalog,
            addonName: addon.userSetName || manifest.name,
            addonId: addon.manifestUrl
          });
        }
      }

      if (Array.isArray(manifest.resources)) {
        for (const resource of manifest.resources) {
          const key = resource.name;
          if (!allResources.has(key)) {
            allResources.set(key, {
              name: resource.name,
              types: resource.types || manifest.types || [],
              idPrefixes: resource.idPrefixes || manifest.idPrefixes || []
            });
          }
        }
      }
    }

    return {
      id: `nuvio-service-${connection.id}`,
      name: connection.name,
      version: "1.0.0",
      description: "Nuvio Streaming Service - Aggregated addons",
      types: ["movie", "series", "anime"],
      resources: Array.from(allResources.values()),
      catalogs: allCatalogs,
      idPrefixes: ["tt", "kitsu", "tmdb:", "mal:"]
    };
  },

  addons() {
    const connections = this.connections();
    return connections
      .filter((c) => c.enabled)
      .map((connection) => ({
        id: `nuvio-service-${connection.id}`,
        baseUrl: `nuvio-service://${connection.id}`,
        name: connection.name,
        displayName: connection.name,
        manifestUrl: `nuvio-service://${connection.id}`,
        type: "nuvio-service",
        enabled: true,
        resources: [
          { name: "catalog", types: ["movie", "series", "anime"] },
          { name: "stream", types: ["movie", "series", "anime"] },
          { name: "meta", types: ["movie", "series", "anime"], idPrefixes: ["tt", "kitsu", "tmdb:", "mal:"] },
          { name: "subtitles", types: ["movie", "series", "anime"] }
        ],
        catalogs: [],
        behaviorHints: { configurable: false, p2p: true }
      }));
  },

  // Stremio addon protocol endpoints
  async catalog({ connection, catalogId, type, skip = 0, extraArgs = {}, signal }) {
    const baseUrl = buildBaseUrl(connection);
    const params = new URLSearchParams();
    if (skip > 0) params.set("skip", String(skip));
    if (extraArgs.genre) params.set("genre", extraArgs.genre);
    if (extraArgs.search) params.set("search", extraArgs.search);

    const queryString = params.toString();
    const url = `${baseUrl}/catalog/${type}/${catalogId}${queryString ? `?${queryString}` : ""}`;

    try {
      const result = await httpRequest(url, { includeSessionAuth: false, signal, timeoutMs: 30000 });
      return {
        status: "success",
        data: {
          metas: result?.metas || [],
          nextPage: result?.nextPage,
          cacheMaxAge: result?.cacheMaxAge
        }
      };
    } catch (error) {
      return { status: "error", message: error?.message || "catalog_failed" };
    }
  },

  async meta({ connection, type, id, signal }) {
    const baseUrl = buildBaseUrl(connection);
    const url = `${baseUrl}/meta/${type}/${id}`;

    try {
      const result = await httpRequest(url, { includeSessionAuth: false, signal, timeoutMs: 30000 });
      return result ? { status: "success", data: result } : { status: "error", message: "not_found" };
    } catch (error) {
      return { status: "error", message: error?.message || "meta_failed" };
    }
  },

  async streams({ connection, type, id, signal }) {
    const baseUrl = buildBaseUrl(connection);
    const url = `${baseUrl}/stream/${type}/${id}`;

    try {
      const result = await httpRequest(url, { includeSessionAuth: false, signal, timeoutMs: 30000 });
      const streams = Array.isArray(result) ? result : [];
      return { status: "success", data: streams };
    } catch (error) {
      return { status: "error", message: error?.message || "streams_failed" };
    }
  },

  async subtitles({ connection, type, id, signal }) {
    const baseUrl = buildBaseUrl(connection);
    const url = `${baseUrl}/subtitles/${type}/${id}`;

    try {
      const result = await httpRequest(url, { includeSessionAuth: false, signal, timeoutMs: 15000 });
      return { status: "success", data: result?.subtitles || [] };
    } catch (error) {
      return { status: "error", message: error?.message || "subtitles_failed" };
    }
  },

  update(id, partial) {
    const connections = getConnections();
    const index = connections.findIndex((c) => c.id === id);
    if (index >= 0) {
      connections[index] = { ...connections[index], ...partial };
      setConnections(connections);
      this.changed();
    }
  },

  async remove(id) {
    const connections = getConnections();
    const remaining = connections.filter((c) => c.id !== id);
    setConnections(remaining);
    this.changed();
    if (remaining.length === 0) {
      this.stopAddonChangeListener();
    }
  },

  changed() {
    globalThis.document?.dispatchEvent?.(new CustomEvent("nuvio:nuvio-service-changed"));
  },

  isNuvioServiceBase(base) {
    return String(base || "").startsWith("nuvio-service://");
  },

  parseBase(base) {
    const match = String(base || "").match(/^nuvio-service:\/\/([^?]+)/);
    return match ? match[1] : null;
  },

  fromBase(base) {
    const id = this.parseBase(base);
    return id ? this.connection(id) : null;
  }
};

export function buildNuvioServiceCatalogUrl(connection, type, catalogId, skip, extraArgs) {
  const baseUrl = buildBaseUrl(connection);
  const params = new URLSearchParams();
  if (skip > 0) params.set("skip", String(skip));
  if (extraArgs.genre) params.set("genre", extraArgs.genre);
  if (extraArgs.search) params.set("search", extraArgs.search);

  const queryString = params.toString();
  return `${baseUrl}/catalog/${type}/${catalogId}${queryString ? `?${queryString}` : ""}`;
}