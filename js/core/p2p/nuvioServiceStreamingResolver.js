import { NuvioServiceRepository } from "../../data/mediaserver/nuvioServiceRepository.js";

const NUVIO_SERVICE_STREAMING_KIND = "nuvio-service-streaming";

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

function buildPlaybackUrl(baseUrl, infoHash, fileIdx) {
  const root = String(baseUrl || "").replace(/\/+$/, "");
  return `${root}/stream/${encodeURIComponent(infoHash)}/${encodeURIComponent(String(fileIdx))}`;
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

  getResolvedStreamState(stream = {}) {
    const infoHash = getInfoHash(stream);
    if (!infoHash) return null;
    const fileIdx = getFileIdx(stream);
    const baseUrl = this.getStreamingServerBaseUrl(stream);
    if (!baseUrl) return null;
    const playbackUrl = buildPlaybackUrl(baseUrl, infoHash, fileIdx);
    return {
      kind: NUVIO_SERVICE_STREAMING_KIND,
      infoHash,
      fileIdx,
      playbackUrl,
      baseUrl,
      baseUrlKind: "remote-service",
      mimeType: String(stream?.mimeType || stream?.sourceType || "").trim() || "video/mp4",
    };
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
    const playbackUrl = buildPlaybackUrl(baseUrl, infoHash, fileIdx);
    console.log('[NuvioServiceStreamingResolver] resolve:', { infoHash, fileIdx, baseUrl, playbackUrl });
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
    if (!normalizedHash) {
      return { status: "unsupported" };
    }
    const connections = NuvioServiceRepository.connections().filter((c) => c.enabled);
    for (const connection of connections) {
      const streamingUrl = await getStreamingServerUrl(connection);
      if (!streamingUrl) continue;
      try {
        const response = await fetch(`${streamingUrl}/${encodeURIComponent(normalizedHash)}/remove`, {
          method: "GET",
          cache: "no-cache",
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (response.ok || response.status === 404) {
          return { status: "success", baseUrl: streamingUrl };
        }
      } catch (_) {}
    }
    return { status: "unavailable", detail: "NuvioService streaming server remove endpoint unavailable" };
  },
};