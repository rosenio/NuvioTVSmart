import { NuvioServiceRepository } from "../../data/mediaserver/nuvioServiceRepository.js";

const NUVIO_SERVICE_STREAMING_KIND = "nuvio-service-streaming";

// DEBUG
console.log('[NuvioServiceStreamingResolver] Module loaded, getResolvedStreamState:', typeof NuvioServiceStreamingResolver?.getResolvedStreamState);

function normalizeInfoHash(hash = "") {
  return String(hash || "").toLowerCase().replace(/[^0-9a-f]/g, "");
}

function getInfoHash(stream = {}) {
  return (
    normalizeInfoHash(stream?.infoHash) ||
    normalizeInfoHash(stream?.clientResolve?.infoHash) ||
    normalizeInfoHash(stream?.raw?.infoHash) ||
    normalizeInfoHash(stream?.raw?.clientResolve?.infoHash) ||
    ""
  );
}

function getFileIdx(stream = {}) {
  const candidates = [
    stream?.fileIdx,
    stream?.clientResolve?.fileIdx,
    stream?.raw?.fileIdx,
    stream?.raw?.clientResolve?.fileIdx,
  ];
  for (const idx of candidates) {
    if (Number.isFinite(Number(idx)) && Number(idx) >= 0) {
      return Number(idx);
    }
  }
  return -1;
}

function buildPlaybackUrl(baseUrl, infoHash, fileIdx, magnetUri, filename, peerSearchSources) {
  const root = String(baseUrl || "").replace(/\/+$/, "");
  const url = `${root}/stream/${encodeURIComponent(infoHash)}/${encodeURIComponent(String(fileIdx))}`;
  const params = [];
  if (magnetUri) {
    params.push(`magnet=${encodeURIComponent(magnetUri)}`);
  }
  if (filename) {
    params.push(`filename=${encodeURIComponent(filename)}`);
  }
  if (peerSearchSources && peerSearchSources.length > 0) {
    params.push(`peerSearch=${encodeURIComponent(JSON.stringify({ sources: peerSearchSources }))}`);
  }
  return params.length > 0 ? `${url}?${params.join('&')}` : url;
}

async function getStreamingServerUrl(connection) {
  if (connection.streamingServerUrl) {
    return connection.streamingServerUrl;
  }
  if (connection.streamingServerPort) {
    return `http://${connection.address}:${connection.streamingServerPort}`;
  }
  try {
    const baseUrl = `http://${connection.address}:${connection.port || 11471}`;
    const settings = await fetch(`${baseUrl}/settings`, {
      method: "GET",
      cache: "no-cache",
    }).then((r) => (r.ok ? r.json() : null));
    if (settings?.streaming_server_url) {
      return settings.streaming_server_url;
    }
  } catch (_) {}
  return `http://${connection.address}:11470`;
}

export const NuvioServiceStreamingResolver = {
  kind: NUVIO_SERVICE_STREAMING_KIND,

  canResolveStream(stream = {}) {
    const infoHash = getInfoHash(stream);
    if (!infoHash) return false;
    const addonBaseUrl = stream?.addonBaseUrl || stream?.raw?.addonBaseUrl;
    const canResolve = addonBaseUrl && NuvioServiceRepository.isNuvioServiceBase(addonBaseUrl);
    console.log('[NuvioServiceStreamingResolver] canResolveStream:', { infoHash, canResolve, addonBaseUrl });
    return Boolean(canResolve);
  },

  isNuvioServiceStream(stream = {}) {
    return this.canResolveStream(stream);
  },

  async getStreamingServerBaseUrl(stream = {}) {
    const addonBaseUrl = stream?.addonBaseUrl || stream?.raw?.addonBaseUrl;
    console.log('[NuvioServiceStreamingResolver] getStreamingServerBaseUrl: addonBaseUrl:', addonBaseUrl);
    if (!addonBaseUrl || !NuvioServiceRepository.isNuvioServiceBase(addonBaseUrl)) return null;
    const connectionId = NuvioServiceRepository.parseBase(addonBaseUrl);
    const connection = connectionId ? NuvioServiceRepository.connection(connectionId) : null;
    if (!connection?.enabled) return null;
    return getStreamingServerUrl(connection);
  },

  async getResolvedStreamState(stream = {}) {
    const infoHash = getInfoHash(stream);
    console.log('[NuvioServiceStreamingResolver] getResolvedStreamState called:', { infoHash, hasAddonBaseUrl: !!(stream?.addonBaseUrl || stream?.raw?.addonBaseUrl), hasPlaybackUrl: !!(stream?.url || stream?.externalUrl || stream?.playbackUrl) });
    if (!infoHash) return null;
    const fileIdx = getFileIdx(stream);
    
    // Try to get baseUrl from stream (addonBaseUrl method)
    let baseUrl = await this.getStreamingServerBaseUrl(stream);
    
    // Fallback: extract baseUrl from playback URL (like Tizen resolver does)
    if (!baseUrl) {
      const playbackUrl = String(stream?.url || stream?.externalUrl || stream?.playbackUrl || "").trim();
      if (playbackUrl) {
        try {
          const parsed = new URL(playbackUrl);
          baseUrl = `${parsed.protocol}//${parsed.host}`;
        } catch (_) {}
      }
    }
    
    if (!baseUrl) {
      console.log('[NuvioServiceStreamingResolver] getResolvedStreamState: no baseUrl, returning null');
      return null;
    }
    const finalPlaybackUrl = buildPlaybackUrl(baseUrl, infoHash, fileIdx);
    const result = {
      kind: NUVIO_SERVICE_STREAMING_KIND,
      infoHash,
      fileIdx,
      playbackUrl: finalPlaybackUrl,
      baseUrl,
      baseUrlKind: "remote-service",
      mimeType: String(stream?.mimeType || stream?.sourceType || "").trim() || "video/mp4",
    };
    console.log('[NuvioServiceStreamingResolver] getResolvedStreamState returning:', { infoHash, fileIdx, kind: result.kind, baseUrl: result.baseUrl });
    return result;
  },

  async resolve(stream = {}, context = {}) {
    const infoHash = getInfoHash(stream);
    if (!infoHash) {
      return { status: "unsupported", detail: "Missing torrent infoHash" };
    }
    const fileIdx = getFileIdx(stream);
    const baseUrl = await this.getStreamingServerBaseUrl(stream);
    if (!baseUrl) {
      return { status: "unsupported", detail: "NuvioService streaming server not configured" };
    }
    // Build magnet URI from infoHash and available sources/trackers
    const sources = stream?.sources || stream?.raw?.sources || stream?.behaviorHints?.sources || [];
    const trackers = Array.isArray(sources) ? sources.filter(s => s.startsWith('tracker:') || s.startsWith('dht:')) : [];
    // Default public trackers (used by Stremio streaming servers) when addon doesn't provide any
    const defaultTrackers = [
      'udp://tracker.openbittorrent.com:80',
      'udp://tracker.opentrackr.org:1337',
      'udp://tracker.torrent.eu.org:451',
      'udp://tracker.bittor.pw:1337',
      'https://tracker.nanoha.org:443/announce',
    ];
    let magnetUri = `magnet:?xt=urn:btih:${infoHash}`;
    const allTrackers = trackers.length > 0
      ? trackers.map(t => t.replace(/^tracker:/, '').replace(/^dht:/, ''))
      : defaultTrackers;
    const trParams = allTrackers.map(t => `tr=${encodeURIComponent(t)}`).join('&');
    magnetUri += `&${trParams}`;
    // Pass filename for matching in case fileIdx doesn't match torrent's file order
    const filename = stream?.behaviorHints?.filename || stream?.raw?.behaviorHints?.filename;
    // Build peer search sources like webOS service: dht:infoHash + trackers
    const peerSearchSources = ['dht:' + infoHash, ...allTrackers.map(t => 'tracker:' + t)];
    const playbackUrl = buildPlaybackUrl(baseUrl, infoHash, fileIdx, magnetUri, filename, peerSearchSources);
    console.log('[NuvioServiceStreamingResolver] resolve:', { infoHash, fileIdx, baseUrl, playbackUrl, hasMagnet: true, trackers: allTrackers.length, filename, peerSearchSources: peerSearchSources.length });
    return {
      status: "success",
      stream: {
        ...stream,
        url: playbackUrl,
        externalUrl: null,
        infoHash,
        fileIdx,
        mimeType: "video/mp4",
        sourceType: "hls",
        nuvioServiceStreaming: {
          baseUrl,
          infoHash,
          fileIdx,
        },
        raw: {
          ...(stream?.raw || {}),
          nuvioServiceStreaming: { baseUrl, infoHash, fileIdx },
        },
      },
    };
  },

  async remove(infoHash, { timeoutMs = 2500 } = {}) {
    const normalizedHash = normalizeInfoHash(infoHash);
    console.log('[NuvioServiceStreamingResolver] remove called:', { infoHash: normalizedHash });
    if (!normalizedHash) {
      return { status: "unsupported" };
    }
    const connections = NuvioServiceRepository.connections().filter((c) => c.enabled);
    console.log('[NuvioServiceStreamingResolver] remove: found connections:', connections.length);
    for (const connection of connections) {
      const streamingUrl = await getStreamingServerUrl(connection);
      if (!streamingUrl) continue;
      console.log('[NuvioServiceStreamingResolver] remove: calling', `${streamingUrl}/${normalizedHash}/remove`);
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const response = await fetch(`${streamingUrl}/${encodeURIComponent(normalizedHash)}/remove`, {
          method: "GET",
          cache: "no-cache",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        console.log('[NuvioServiceStreamingResolver] remove: response status:', response.status);
        if (response.ok || response.status === 404) {
          return { status: "success", baseUrl: streamingUrl };
        }
      } catch (e) {
        console.log('[NuvioServiceStreamingResolver] remove: error:', e.message);
      }
    }
    return { status: "unavailable", detail: "NuvioService streaming server remove endpoint unavailable" };
  },
};