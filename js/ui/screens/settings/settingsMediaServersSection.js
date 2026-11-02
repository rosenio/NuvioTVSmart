import { MediaServerRepository } from "../../../data/mediaserver/mediaServerRepository.js";
import { NuvioServiceRepository } from "../../../data/mediaserver/nuvioServiceRepository.js";
import { ProfileManager } from "../../../core/profile/profileManager.js";
import { I18n } from "../../../i18n/index.js";
import { canDiscoverNuvioService } from "../../../core/network/nuvioServiceDiscovery.js";
import { httpRequest } from "../../../core/network/httpClient.js";
const t = (key, params = []) => I18n.t(key, params, { fallback: key });
export function renderMediaServersSection() {
  const pid = String(ProfileManager.getActiveProfileId());
  if (this.mediaServerProfileId !== pid) {
    this.mediaServerProfileId = pid;
    this.mediaServerDraft = null;
    this.mediaServersView = "list";
    this.mediaServerError = null;
  }
  const view = this.mediaServersView;
  const mount = this.settingsMountToken;
  const current = () =>
    this.isMounted &&
    this.activeSection === "contentDiscovery" &&
    this.settingsMountToken === mount &&
    String(ProfileManager.getActiveProfileId()) === pid &&
    this.mediaServersView === view;

  // Resolve connection for both MediaServer and NuvioService
  let connection = null;
  let isNuvioServiceConnection = false;
  if (view?.startsWith("nuvio:")) {
    const connectionId = view.slice(6);
    connection = NuvioServiceRepository.connection(connectionId);
    isNuvioServiceConnection = true;
  } else {
    connection = MediaServerRepository.connection(view);
  }
  const back = () => {
    this.mediaServerDraft = null;
    this.mediaServerError = null;
    this.mediaServersView = view === "list" ? null : "list";
    this.contentFocusKey = "mediaServers:back";
  };
  this.actionMap.set("mediaServers:back", back);

  // Status tracking for refresh
  this._nuvioStatusRefreshing = this._nuvioStatusRefreshing || new Set();
  this._nuvioStatusCache = this._nuvioStatusCache || new Map();
  
  // Check Nuvio Service connection status (async, updates cache)
  this.checkNuvioServiceStatus = async (connection) => {
    const key = `${connection.address}:${connection.port}`;
    try {
      const baseUrl = `http://${connection.address}:${connection.port}`;
      const response = await httpRequest(`${baseUrl}/health`, {
        includeSessionAuth: false,
        timeoutMs: 3000
      });
      const status = (response?.status === 'ok') ? 'online' : 'offline';
      this._nuvioStatusCache.set(key, status);
      return status;
    } catch {
      this._nuvioStatusCache.set(key, 'offline');
      return 'offline';
    }
  };

  // Render status indicator text (ONLINE/OFFLINE/CHECKING...)
  this.renderStatusIndicatorText = (status) => {
    const labels = {
      online: 'ONLINE',
      offline: 'OFFLINE',
      refreshing: 'CHECKING...'
    };
    return labels[status] || labels.offline;
  };

  // Get status color
  this.getStatusColor = (status) => {
    const colors = {
      online: '#00ff00',
      offline: '#ff0000',
      refreshing: '#888888'
    };
    return colors[status] || colors.offline;
  };

  // Render status indicator (green=online, red=offline, gray=refreshing)
  this.renderStatusIndicator = (status) => {
    const colors = {
      online: '#00ff00',
      offline: '#ff0000',
      refreshing: '#888888'
    };
    const labels = {
      online: 'ONLINE',
      offline: 'OFFLINE',
      refreshing: 'CHECKING...'
    };
    const color = colors[status] || colors.offline;
    const label = labels[status] || labels.offline;
    return `<span style="color: ${color}; font-size: 0.7em; margin-left: 8px;">[${label}]</span>`;
  };

  let body = this.renderActionRow({
    focusKey: "mediaServers:back",
    title: t("action_back"),
    icon: ""
  });
  if (view === "add") {
    const draft = (this.mediaServerDraft ||= {
      providerId: "nuvio-service",
      address: "192.168.15.4:11471",
      username: "",
      password: ""
    });
    this.actionMap.set("mediaServers:provider", () =>
      this.openOptionDialog({
        title: t("settings_media_servers"),
        options: [
          { id: "jellyfin", label: "Jellyfin" },
          { id: "emby", label: "Emby" },
          { id: "nuvio-service", label: "Nuvio Service" }
        ],
        selectedId: draft.providerId,
        returnFocusKey: "mediaServers:provider",
        onSelect: (option) => {
          draft.providerId = option.id;
          if (option.id === "nuvio-service") {
            draft.username = "";
            draft.password = "";
          }
        }
      })
    );
    body += this.renderActionRow({
      focusKey: "mediaServers:provider",
      title: t("settings_media_servers"),
      value: draft.providerId === "emby" ? "Emby" : draft.providerId === "nuvio-service" ? "Nuvio Service" : "Jellyfin"
    });
    const isNuvioService = draft.providerId === "nuvio-service";
    const fields = isNuvioService ? ["address"] : ["address", "username", "password"];
    for (const field of fields) {
      this.actionMap.set(`mediaServers:${field}`, () =>
        this.openTextDialog({
          title: t(`servers_${field}`),
          value: draft[field],
          secret: field === "password",
          inputType: field === "address" ? "url" : "text",
          placeholder: field === "address" ? (isNuvioService ? "192.168.1.100:11471" : t("servers_address_hint")) : "",
          returnFocusKey: `mediaServers:${field}`,
          onSubmit: (value) => {
            draft[field] = value;
          }
        })
      );
      body += this.renderActionRow({
        focusKey: `mediaServers:${field}`,
        title: t(`servers_${field}`),
        value: field === "password" ? (draft.password ? "••••••" : "") : draft[field]
      });
    }
    this.actionMap.set("mediaServers:discoverNuvioService", async () => {
      if (!current()) return;
      try {
        const { discoverNuvioService, canDiscoverNuvioService } = await import(
          "../../../core/network/nuvioServiceDiscovery.js"
        );
        if (!canDiscoverNuvioService()) {
          this.mediaServerError = "mDNS discovery not supported on this platform";
          return;
        }
        this.mediaServerError = "Discovering Nuvio Service...";
        await this.render();
        const services = await discoverNuvioService({ timeoutMs: 8000 });
        if (!current()) return;
        if (services.length === 0) {
          this.mediaServerError = "No Nuvio Service found on LAN";
          await this.render();
          return;
        }
        // Use the first discovered service
        const service = services[0];
        draft.address = `${service.address}:${service.port}`;
        if (service.streamingPort) {
          draft.streamingServerPort = parseInt(service.streamingPort, 10);
        }
        this.mediaServerError = `Found: ${service.name} (${service.address}:${service.port})`;
        await this.render();
      } catch (error) {
        if (!current()) return;
        this.mediaServerError = `Discovery failed: ${error?.message || error}`;
        await this.render();
      }
    });
    if (isNuvioService && canDiscoverNuvioService()) {
      body += this.renderActionRow({
        focusKey: "mediaServers:discoverNuvioService",
        title: "Discover on LAN (mDNS)",
        icon: "🔍"
      });
    }
    this.actionMap.set("mediaServers:connect", async () => {
      if (!current() || this.mediaServerConnecting) return;
      this.mediaServerConnecting = true;
      this.mediaServerError = null;
      try {
        if (isNuvioService) {
          const [address, portStr] = (draft.address || "").split(":");
          const port = portStr ? parseInt(portStr, 10) : 11471;
          const entry = await NuvioServiceRepository.connect({ address, port, connectionId: draft.connectionId });
          if (current()) {
            this.mediaServersView = entry.id;
            this.mediaServerDraft = null;
          }
        } else {
          const entry = await MediaServerRepository.connect({ ...draft });
          if (current()) {
            this.mediaServersView = entry.id;
            this.mediaServerDraft = null;
          }
        }
      } catch (error) {
        if (!current()) return;
        this.mediaServerError = t(
          error?.message?.startsWith("servers_") || error?.message?.startsWith("nuvio_service_")
            ? error.message
            : isNuvioService
            ? "nuvio_service_unreachable"
            : "servers_error_unreachable",
          isNuvioService ? [] : [draft.providerId === "emby" ? "Emby" : "Jellyfin", draft.providerId === "emby" ? "4.7" : "10.9"]
        );
      } finally {
        draft.password = "";
        this.mediaServerConnecting = false;
      }
    });
    body += this.renderActionRow({
      focusKey: "mediaServers:connect",
      title: t(this.mediaServerConnecting ? "servers_connecting" : "servers_connect"),
      disabled: this.mediaServerConnecting
    });
  } else if (connection && isNuvioServiceConnection) {
    // Use cached status (async check triggered separately)
    const key = `${connection.address}:${connection.port}`;
    const cachedStatus = this._nuvioStatusCache?.get(key) || 'offline';
    const statusColors = { online: '#00ff00', offline: '#ff0000', refreshing: '#888888' };
    const statusLabels = { online: 'ONLINE', offline: 'OFFLINE', refreshing: 'CHECKING...' };
    const color = statusColors[cachedStatus] || statusColors.offline;
    const label = statusLabels[cachedStatus] || statusLabels.offline;
    body += `<h3>${this.escapeMediaServerText(connection.name)}</h3><p>${this.escapeMediaServerText(`${connection.address}:${connection.port}`)}  •  <span style="color: ${color};">${label}</span></p>`;

    // Trigger async status check if not already checked or refreshing
    if (cachedStatus === 'offline' && !this._nuvioStatusRefreshing?.has(key)) {
      this.checkNuvioServiceStatus(connection).then(() => {
        if (current()) this.render();
      });
    }
    for (const [field, label] of [
      ["enabled", "servers_enabled"]
    ]) {
      this.actionMap.set(
        `mediaServers:${field}`,
        () =>
          current() && NuvioServiceRepository.update(connection.id, { [field]: !connection[field] })
      );
      body += this.renderToggleRow({
        focusKey: `mediaServers:${field}`,
        title: t(label),
        subtitle: t(`${label}_description`, [connection.name]),
        checked: connection[field]
      });
    }
    // Streaming server port configuration
    this.actionMap.set("mediaServers:streamingPort", () => {
      this.openTextInputDialog({
        title: "Streaming Server Port",
        message: "Port for NuvioService streaming server (default: 11470)",
        initialValue: String(connection.streamingServerPort || 11470),
        inputType: "number",
        returnFocusKey: "mediaServers:streamingPort",
        onSubmit: async (value) => {
          if (!current()) return;
          const port = parseInt(value, 10);
          if (!Number.isFinite(port) || port < 1 || port > 65535) {
            this.mediaServerError = "Invalid port number";
            return;
          }
          NuvioServiceRepository.update(connection.id, { streamingServerPort: port });
        }
      });
    });
    body += this.renderActionRow({
      focusKey: "mediaServers:streamingPort",
      title: "Streaming Server Port",
      value: String(connection.streamingServerPort || 11470)
    });
    // Refresh streaming server URL
    const self = this;
    this.actionMap.set("mediaServers:refreshStreamingUrl", async function() {
      if (!current()) return;
      const key = `${connection.address}:${connection.port}`;
      self._nuvioStatusRefreshing = self._nuvioStatusRefreshing || new Set();
      self._nuvioStatusRefreshing.add(key);
      self.render();
      try {
        const baseUrl = `http://${connection.address}:${connection.port}`;
        console.log('[NuvioService] Refreshing streaming server URL from:', baseUrl);
        const settingsResponse = await httpRequest(`${baseUrl}/settings`, {
          includeSessionAuth: false,
          timeoutMs: 10000
        });
        console.log('[NuvioService] Settings response:', settingsResponse);
        if (settingsResponse?.streaming_server_url) {
          NuvioServiceRepository.update(connection.id, { streamingServerUrl: settingsResponse.streaming_server_url });
          self.mediaServerError = null;
        } else {
          self.mediaServerError = "No streaming server URL in response";
        }
        // Also refresh connection status
        await self.checkNuvioServiceStatus(connection);
      } catch (err) {
        if (!current()) return;
        console.error('[NuvioService] Failed to refresh streaming server URL:', err);
        self.mediaServerError = `Failed to refresh streaming server URL: ${err.message || err}`;
      } finally {
        self._nuvioStatusRefreshing.delete(key);
        self.render();
      }
    });
    body += this.renderActionRow({
      focusKey: "mediaServers:refreshStreamingUrl",
      title: "Refresh Streaming Server URL"
    });
    this.actionMap.set("mediaServers:remove", () =>
      this.openOptionDialog({
        title: t("servers_remove_confirm_title"),
        message: t("servers_remove_confirm_message", [connection.name]),
        options: [
          { id: "remove", label: t("servers_remove") },
          { id: "cancel", label: t("action_cancel") }
        ],
        selectedId: "cancel",
        returnFocusKey: "mediaServers:remove",
        onSelect: async (option) => {
          if (current() && option.id === "remove") {
            await NuvioServiceRepository.remove(connection.id);
            if (current()) this.mediaServersView = "list";
          }
        }
      })
    );
    body += this.renderActionRow({ focusKey: "mediaServers:remove", title: t("servers_remove") });
  } else if (connection) {
    // Jellyfin/Emby connection detail view (existing behavior)
    body += `<h3>${this.escapeMediaServerText(connection.name)}</h3><p>${this.escapeMediaServerText(t("servers_signed_in_as", [connection.name, connection.userName]))}</p>`;
    for (const [field, label] of [
      ["enabled", "servers_enabled"],
      ["useCatalogMetadata", "servers_catalog_metadata"],
      ["importWatchState", "servers_import_watch_state"]
    ]) {
      this.actionMap.set(
        `mediaServers:${field}`,
        () =>
          current() && MediaServerRepository.update(connection.id, { [field]: !connection[field] })
      );
      body += this.renderToggleRow({
        focusKey: `mediaServers:${field}`,
        title: t(label),
        subtitle: t(`${label}_description`, [connection.name]),
        checked: connection[field]
      });
    }
    this.actionMap.set("mediaServers:libraries", () =>
      this.openMultiChoiceDialog({
        title: t("servers_libraries"),
        message: t("servers_libraries_description"),
        options: connection.libraries.map((lib) => ({ id: lib.id, label: lib.name })),
        selectedIds: connection.libraries.filter((lib) => lib.selected).map((lib) => lib.id),
        returnFocusKey: "mediaServers:libraries",
        onToggle: (ids) =>
          current() &&
          MediaServerRepository.update(connection.id, {
            libraries: connection.libraries.map((lib) => ({
              ...lib,
              selected: ids.includes(lib.id)
            }))
          })
      })
    );
    body += this.renderActionRow({
      focusKey: "mediaServers:libraries",
      title: t("servers_libraries"),
      value: connection.libraries
        .filter((lib) => lib.selected)
        .map((lib) => lib.name)
        .join(", ")
    });
    this.actionMap.set("mediaServers:refresh", async () => {
      if (!current()) return;
      try {
        await MediaServerRepository.refreshLibraries(connection.id);
      } catch (_) {
        if (!current()) return;
        this.mediaServerError = t("servers_error_unreachable");
      }
    });
    body += this.renderActionRow({
      focusKey: "mediaServers:refresh",
      title: t("servers_refresh_libraries")
    });
    this.actionMap.set("mediaServers:signin", () => {
      this.mediaServerDraft = {
        providerId: connection.providerId,
        address: connection.address,
        username: connection.userName,
        password: "",
        connectionId: connection.id
      };
      this.mediaServersView = "add";
    });
    body += this.renderActionRow({
      focusKey: "mediaServers:signin",
      title: t("servers_sign_in_again")
    });
    this.actionMap.set("mediaServers:remove", () =>
      this.openOptionDialog({
        title: t("servers_remove_confirm_title"),
        message: t("servers_remove_confirm_message", [connection.name]),
        options: [
          { id: "remove", label: t("servers_remove") },
          { id: "cancel", label: t("action_cancel") }
        ],
        selectedId: "cancel",
        returnFocusKey: "mediaServers:remove",
        onSelect: async (option) => {
          if (current() && option.id === "remove") {
            await MediaServerRepository.remove(connection.id);
            if (current()) this.mediaServersView = "list";
          }
        }
      })
    );
    body += this.renderActionRow({ focusKey: "mediaServers:remove", title: t("servers_remove") });
  } else {
    for (const entry of MediaServerRepository.connections()) {
      const id = `mediaServers:open:${entry.id}`;
      this.actionMap.set(id, () => {
        this.mediaServersView = entry.id;
      });
      body += this.renderActionRow({
        focusKey: id,
        title: entry.name,
        value: entry.providerId === "emby" ? "Emby" : "Jellyfin",
        subtitle: entry.userName
      });
    }
    for (const entry of NuvioServiceRepository.connections()) {
      const id = `mediaServers:open:nuvio:${entry.id}`;
      this.actionMap.set(id, () => {
        this.mediaServersView = `nuvio:${entry.id}`;
      });
      // Use cached status for list view, but show refreshing if in progress
      const key = `${entry.address}:${entry.port}`;
      const isRefreshing = this._nuvioStatusRefreshing?.has(key);
      const cachedStatus = this._nuvioStatusCache?.get(key) || 'offline';
      const displayStatus = isRefreshing ? 'refreshing' : cachedStatus;
      body += this.renderActionRow({
        focusKey: id,
        title: entry.name,
        value: "Nuvio Service",
        subtitle: `${entry.address}:${entry.port}`,
        status: displayStatus
      });

      // Trigger async status check if not already checked or refreshing
      if (cachedStatus === 'offline' && !isRefreshing) {
        this.checkNuvioServiceStatus(entry).then(() => {
          if (current()) this.render();
        });
      }
    }
    this.actionMap.set("mediaServers:add", () => {
      this.mediaServerDraft = null;
      this.mediaServersView = "add";
    });
    body += this.renderActionRow({ focusKey: "mediaServers:add", title: t("servers_section_add") });
  }
  return `<div class="settings-group-card"><div class="settings-stack">${body}${this.mediaServerError ? `<p class="settings-trakt-error">${this.escapeMediaServerText(this.mediaServerError)}</p>` : ""}</div></div>`;
}
export function escapeMediaServerText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
