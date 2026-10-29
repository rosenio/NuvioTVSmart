/**
 * LiveTV Repository - Ported from NuvioMobile-Enhanced Kotlin implementation
 * Handles M3U parsing, Xtream/Stalker providers, EPG (XMLTV), and caching
 */

// AbortController polyfill for Tizen 5.0 / Chromium 56
if (typeof AbortController === "undefined") {
  globalThis.AbortController = class AbortController {
    constructor() {
      this.signal = { aborted: false, addEventListener: () => {}, removeEventListener: () => {} };
    }
    abort() {
      this.signal.aborted = true;
    }
  };
}

import { LocalStore } from "../../core/storage/localStore.js";
import {
  createLiveTvChannel,
  createLiveTvEpgProgram,
  createLiveTvPlaylist,
  createLiveTvEpgSource,
  createDefaultStalkerSettings,
  createDefaultXtreamSettings,
  createDefaultLiveTvUiState,
  isStalkerConfigured,
  isXtreamConfigured,
  hasLiveTvPlaylist,
  shouldShowInNavigation,
  stableChannelId,
  stablePlaylistId,
  stableEpgSourceId,
  normalizeEpgChannelName,
  liveTvEpgKey,
  epgIdNameCandidates,
  formatEpgTime,
  formatEpgTimeRange,
  createUrlPlaylist
} from "./LiveTvModels.js";

// Storage keys
const STORAGE_KEYS = {
  PLAYLISTS_BLOB: "livetv_playlists_blob",
  PLAYLIST_URL: "livetv_playlist_url",
  FAVORITE_CHANNELS_BLOB: "livetv_favorite_channels",
  LAST_WATCHED_CHANNEL: "livetv_last_watched_channel",
  NAVIGATION_ENABLED: "livetv_navigation_enabled",
  STALKER_SETTINGS: "livetv_stalker_settings",
  XTREAM_SETTINGS: "livetv_xtream_settings",
  EPG_SOURCES_BLOB: "livetv_epg_sources",
  EPG_AUTO_DETECT: "livetv_epg_auto_detect",
  CHANNELS_CACHE: "livetv_channels_cache",
  EPG_CACHE: "livetv_epg_cache"
};

// Cache TTL constants
const LIVE_TV_EPG_CACHE_TTL_MILLIS = 24 * 60 * 60 * 1000; // 24 hours
const LIVE_TV_EPG_PAST_WINDOW_MILLIS = 3 * 60 * 60 * 1000; // 3 hours
const LIVE_TV_EPG_FUTURE_WINDOW_MILLIS = 48 * 60 * 60 * 1000; // 48 hours

// Delimiters for serialization
const RECORD_SEPARATOR = "\u001E";
const FIELD_SEPARATOR = "\u001F";

// Request headers
const EPG_REQUEST_HEADERS = {
  Accept: "application/xml, text/xml, application/gzip, application/octet-stream, */*",
  "User-Agent": "Nuvio/1.0"
};

const PLAYLIST_REQUEST_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "User-Agent": "Nuvio/1.0"
};

const STREAM_REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0",
  Accept: "*/*"
};

// State management
let _uiState = createDefaultLiveTvUiState();
let _listeners = new Set();
let _hasLoaded = false;
let _channelsRequested = false;
let _channelsSignature = null;
let _refreshAbortController = null;
let _restoredEpg = null;
let _epgAbortController = null;
let _detectedEpgUrls = [];
const _epgGuideCache = new Map();

function notifyListeners() {
  _listeners.forEach((listener) => listener(_uiState));
}

function setUiState(partial) {
  _uiState = { ..._uiState, ...partial };
  notifyListeners();
}

/**
 * Subscribe to UI state changes
 * @param {(state) => void} listener
 * @returns {() => void} Unsubscribe function
 */
export function subscribe(listener) {
  _listeners.add(listener);
  listener(_uiState);
  return () => _listeners.delete(listener);
}

/**
 * Get current UI state
 * @returns {LiveTvUiState}
 */
export function getUiState() {
  return {
    ..._uiState,
    hasPlaylist: hasLiveTvPlaylist(_uiState)
  };
}

/**
 * Ensures repository is loaded from storage
 */
export function ensureLoaded() {
  if (_hasLoaded) return;
  _hasLoaded = true;

  const playlists = loadSavedPlaylists();
  const stalkerSettings = loadStalkerSettings();
  const xtreamSettings = loadXtreamSettings();

  _uiState = {
    ..._uiState,
    playlistUrl:
      playlists.length > 0
        ? playlists.find((p) => p.type === "url" && p.isEnabled)?.source || ""
        : "",
    playlists,
    stalkerSettings,
    xtreamSettings,
    favoriteChannelIds: loadFavoriteChannelIds(),
    lastWatchedChannelId: loadLastWatchedChannelId(),
    isNavigationEnabled: loadNavigationEnabled() ?? true,
    epgSources: decodeEpgSources(loadEpgSourcesBlob() || ""),
    isEpgAutoDetectEnabled: loadEpgAutoDetectEnabled() ?? true
  };

  publishNavigationVisibility();
}

/**
 * Ensures channels are loaded (triggers refresh if needed)
 */
export function ensureChannelsLoaded() {
  ensureLoaded();
  if (_channelsRequested) return;
  const state = _uiState;
  if (!hasLiveTvPlaylist(state)) return;

  _channelsRequested = true;
  const signature = liveTvChannelSourceSignature(state);
  setUiState({ isLoading: true, errorMessage: null });

  _refreshAbortController = new AbortController();
  refreshChannels(signature, _refreshAbortController.signal);
}

/**
 * Saves a single playlist URL (legacy compatibility)
 * @param {string} url
 */
export function savePlaylistUrl(url) {
  ensureLoaded();
  const normalized = url.trim();
  const playlists = normalized === "" ? [] : [createUrlPlaylist(normalized)];
  persistPlaylists(playlists);
  setUiState({
    playlistUrl: playlists[0]?.source || "",
    playlists,
    channels: [],
    isLoading: false,
    errorMessage: null
  });
  publishNavigationVisibility();
  if (playlists.length > 0) refresh();
}

/**
 * Adds a playlist URL
 * @param {string} url
 * @param {string} [name]
 */
export function addPlaylistUrl(url, name = null) {
  ensureLoaded();
  const normalized = url.trim();
  if (normalized === "") return;

  const current = _uiState.playlists;
  if (current.some((p) => p.type === "url" && p.source.equalsIgnoreCase(normalized))) return;

  const playlists = [...current, createUrlPlaylist(normalized, name)];
  persistPlaylists(playlists);
  setUiState({
    playlistUrl: playlists.find((p) => p.type === "url" && p.isEnabled)?.source || "",
    playlists,
    errorMessage: null
  });
  publishNavigationVisibility();
  refresh();
}

/**
 * Adds a local playlist from file content
 * @param {string} content
 * @param {string} [fileName]
 * @param {string} [name]
 */
export function addLocalPlaylist(content, fileName = null, name = null) {
  ensureLoaded();
  const normalizedContent = content.trim();
  if (normalizedContent === "") return;

  const fallbackName = (
    name?.trim() ||
    fileName?.replace(/\.[^.]+$/, "") ||
    "Local playlist"
  ).trim();
  const playlist = createLiveTvPlaylist({
    id: stablePlaylistId(
      `local:${fallbackName}:${normalizedContent.hashCode()}:${Math.random()}`,
      current.length
    ),
    name: fallbackName,
    type: "local_file",
    source: normalizedContent,
    isEnabled: true
  });

  const playlists = [..._uiState.playlists, playlist];
  persistPlaylists(playlists);
  setUiState({
    playlistUrl: playlists.find((p) => p.type === "url" && p.isEnabled)?.source || "",
    playlists,
    errorMessage: null
  });
  publishNavigationVisibility();
  refresh();
}

/**
 * Updates an existing playlist
 * @param {string} playlistId
 * @param {string} name
 * @param {string} source
 */
export function updatePlaylist(playlistId, name, source) {
  ensureLoaded();
  const current = _uiState.playlists;
  const existing = current.find((p) => p.id === playlistId);
  if (!existing) return;

  const normalizedName = name.trim() || existing.name;
  const normalizedSource = source.trim();
  if (normalizedSource === "") return;

  if (
    existing.type === "url" &&
    current.some(
      (p) => p.id !== playlistId && p.type === "url" && p.source.equalsIgnoreCase(normalizedSource)
    )
  )
    return;

  const playlists = current.map((p) =>
    p.id === playlistId ? { ...p, name: normalizedName, source: normalizedSource } : p
  );
  persistPlaylists(playlists);
  setUiState({
    playlistUrl: playlists.find((p) => p.type === "url" && p.isEnabled)?.source || "",
    playlists,
    errorMessage: null
  });
  publishNavigationVisibility();
  refresh();
}

/**
 * Removes a playlist
 * @param {string} playlistId
 */
export function removePlaylist(playlistId) {
  ensureLoaded();
  const playlists = _uiState.playlists.filter((p) => p.id !== playlistId);
  persistPlaylists(playlists);
  setUiState({
    playlistUrl: playlists.find((p) => p.type === "url" && p.isEnabled)?.source || "",
    playlists,
    channels: [],
    isLoading: false,
    errorMessage: null
  });
  publishNavigationVisibility();
  if (playlists.some((p) => p.isEnabled)) refresh();
}

/**
 * Sets playlist enabled state
 * @param {string} playlistId
 * @param {boolean} isEnabled
 */
export function setPlaylistEnabled(playlistId, isEnabled) {
  ensureLoaded();
  const current = _uiState.playlists;
  if (!current.some((p) => p.id === playlistId)) return;

  const playlists = current.map((p) => (p.id === playlistId ? { ...p, isEnabled } : p));
  persistPlaylists(playlists);
  setUiState({
    playlistUrl: playlists.find((p) => p.type === "url" && p.isEnabled)?.source || "",
    playlists,
    channels: [],
    isLoading: false,
    errorMessage: null
  });
  publishNavigationVisibility();
  if (playlists.some((p) => p.isEnabled)) refresh();
}

/**
 * Sets navigation enabled state
 * @param {boolean} enabled
 */
export function setNavigationEnabled(enabled) {
  ensureLoaded();
  if (_uiState.isNavigationEnabled === enabled) return;
  saveNavigationEnabled(enabled);
  setUiState({ isNavigationEnabled: enabled });
  publishNavigationVisibility();
}

/**
 * Saves Stalker portal settings
 * @param {LiveTvStalkerSettings} settings
 */
export function saveStalkerSettings(settings) {
  ensureLoaded();
  const normalized = {
    ...settings,
    portalUrl: settings.portalUrl.trim().replace(/\/+$/, ""),
    macAddress: settings.macAddress.trim().toUpperCase(),
    username: settings.username.trim(),
    password: settings.password.trim()
  };
  saveStalkerSettingsToStorage(normalized);
  setUiState({ stalkerSettings: normalized, errorMessage: null });
  publishNavigationVisibility();
  refresh();
}

/**
 * Saves Xtream Codes settings
 * @param {LiveTvXtreamSettings} settings
 */
export function saveXtreamSettings(settings) {
  ensureLoaded();
  const normalized = {
    ...settings,
    serverUrl: settings.serverUrl
      .trim()
      .replace(/\/+$/, "")
      .replace(/\/player_api\.php.*$/, ""),
    username: settings.username.trim(),
    password: settings.password.trim()
  };
  saveXtreamSettingsToStorage(normalized);
  setUiState({ xtreamSettings: normalized, errorMessage: null });
  publishNavigationVisibility();
  refresh();
}

/**
 * Removes Stalker settings
 */
export function removeStalker() {
  saveStalkerSettings(createDefaultStalkerSettings());
}

/**
 * Removes Xtream settings
 */
export function removeXtream() {
  saveXtreamSettings(createDefaultXtreamSettings());
}

/**
 * Triggers channel refresh
 */
export function reloadChannels() {
  refresh();
}

/**
 * Triggers EPG refresh
 * @param {boolean} force
 */
export function reloadEpg(force = true) {
  refreshEpg(force);
}

/**
 * Prepares channel for playback (resolves Stalker dynamic links)
 * @param {LiveTvChannel} channel
 * @returns {Promise<LiveTvChannel>}
 */
export async function prepareForPlayback(channel) {
  if (!channel.stalkerCommand) return channel;
  return preparePortalChannelForPlayback(channel, _uiState.stalkerSettings);
}

/**
 * Toggles channel favorite status
 * @param {string} channelId
 */
export function toggleFavoriteChannel(channelId) {
  ensureLoaded();
  const favorites = new Set(_uiState.favoriteChannelIds);
  if (favorites.has(channelId)) {
    favorites.delete(channelId);
  } else {
    favorites.add(channelId);
  }
  persistFavoriteChannelIds(favorites);
  setUiState({ favoriteChannelIds: favorites });
}

/**
 * Marks channel as last watched
 * @param {LiveTvChannel} channel
 */
export function markChannelWatched(channel) {
  ensureLoaded();
  saveLastWatchedChannelId(channel.id);
  setUiState({ lastWatchedChannelId: channel.id });
}

/**
 * Adds an EPG source
 * @param {string} url
 * @param {string} [name]
 */
export function addEpgSource(url, name = null) {
  ensureLoaded();
  const normalized = url.trim();
  if (normalized === "") return;
  const current = _uiState.epgSources;
  if (current.some((s) => s.url.equalsIgnoreCase(normalized))) return;

  const source = createLiveTvEpgSource({
    id: stableEpgSourceId(normalized, current.length),
    name: name?.trim() || epgSourceNameFromUrl(normalized),
    url: normalized,
    isEnabled: true
  });
  updateEpgSources([...current, source]);
}

/**
 * Removes an EPG source
 * @param {string} sourceId
 */
export function removeEpgSource(sourceId) {
  ensureLoaded();
  updateEpgSources(_uiState.epgSources.filter((s) => s.id !== sourceId));
}

/**
 * Sets EPG source enabled state
 * @param {string} sourceId
 * @param {boolean} isEnabled
 */
export function setEpgSourceEnabled(sourceId, isEnabled) {
  ensureLoaded();
  const current = _uiState.epgSources;
  if (!current.some((s) => s.id === sourceId)) return;
  updateEpgSources(current.map((s) => (s.id === sourceId ? { ...s, isEnabled } : s)));
}

/**
 * Sets EPG auto-detect enabled
 * @param {boolean} enabled
 */
export function setEpgAutoDetectEnabled(enabled) {
  ensureLoaded();
  if (_uiState.isEpgAutoDetectEnabled === enabled) return;
  saveEpgAutoDetectEnabled(enabled);
  setUiState({ isEpgAutoDetectEnabled: enabled });
  refreshEpg(false);
}

/**
 * Refreshes channels from all sources
 * @param {string} signature
 * @param {AbortSignal} signal
 */
async function refreshChannels(signature, signal) {
  const currentState = _uiState;
  const playlists = currentState.playlists;
  const enabledPlaylists = playlists.filter((p) => p.isEnabled);
  const hasEnabledPortal =
    (isXtreamConfigured(currentState.xtreamSettings) && currentState.xtreamSettings.isEnabled) ||
    (isStalkerConfigured(currentState.stalkerSettings) && currentState.stalkerSettings.isEnabled);

  if (enabledPlaylists.length === 0 && !hasEnabledPortal) {
    setUiState({
      playlistUrl: "",
      playlists,
      channels: [],
      isLoading: false,
      errorMessage: null
    });
    return;
  }

  const loadedChannels = [];
  const failedPlaylistNames = [];
  const playlistEpgUrls = [];

  // Load M3U playlists
  const playlistPromises = enabledPlaylists.map(async (playlist) => {
    try {
      const payload =
        playlist.type === "url" ? await fetchText(playlist.source, signal) : playlist.source;
      const [epgUrls, channels] = await parseM3uPlaylist(payload, playlist);
      return { playlist, epgUrls, channels, error: null };
    } catch (error) {
      if (signal.aborted) throw error;
      return { playlist, epgUrls: [], channels: [], error };
    }
  });

  const playlistResults = await Promise.all(playlistPromises);

  for (const result of playlistResults) {
    if (result.error) {
      failedPlaylistNames.push(result.playlist.name);
      console.warn("Failed to load live TV playlist", result.playlist.name, result.error);
    } else {
      playlistEpgUrls.push(...result.epgUrls);
      loadedChannels.push(...result.channels);
    }
  }

  // Load Xtream
  if (isXtreamConfigured(currentState.xtreamSettings) && currentState.xtreamSettings.isEnabled) {
    try {
      const xtreamChannels = await fetchXtreamChannels(currentState.xtreamSettings, signal);
      loadedChannels.push(...xtreamChannels);
    } catch (error) {
      if (!signal.aborted) {
        failedPlaylistNames.push("Xtream");
        console.warn("Failed to load Xtream provider", error);
      }
    }
  }

  // Load Stalker
  if (isStalkerConfigured(currentState.stalkerSettings) && currentState.stalkerSettings.isEnabled) {
    try {
      const stalkerChannels = await fetchStalkerChannels(currentState.stalkerSettings, signal);
      loadedChannels.push(...stalkerChannels);
    } catch (error) {
      if (!signal.aborted) {
        failedPlaylistNames.push("Stalker Portal");
        console.warn("Failed to load Stalker provider", error);
      }
    }
  }

  // Deduplicate by stream URL
  const fetchedChannels = loadedChannels.filter(
    (ch, i, arr) => arr.findIndex((c) => c.streamUrl === ch.streamUrl) === i
  );

  const previousChannels = _uiState.channels;

  // Keep previous if fetch failed but we had cached channels
  const keepPrevious =
    fetchedChannels.length === 0 &&
    failedPlaylistNames.length > 0 &&
    previousChannels.length > 0 &&
    _channelsSignature === signature;

  const channels = keepPrevious ? previousChannels : fetchedChannels;

  let errorMessage = null;
  if (channels.length === 0 && failedPlaylistNames.length > 0) {
    errorMessage = "Playlist could not be loaded.";
  } else if (channels.length === 0) {
    errorMessage = "No channels found in these playlists.";
  } else if (failedPlaylistNames.length > 0) {
    errorMessage = `Some playlists could not be loaded: ${failedPlaylistNames.join(", ")}`;
  }

  setUiState({
    playlistUrl: playlists.find((p) => p.type === "url" && p.isEnabled)?.source || "",
    playlists,
    channels,
    isLoading: false,
    errorMessage
  });

  if (!keepPrevious) {
    const channelsChanged =
      previousChannels.length > 0 &&
      JSON.stringify(previousChannels) !== JSON.stringify(fetchedChannels);
    if (channelsChanged) _restoredEpg = null;

    _detectedEpgUrls = [...new Set(playlistEpgUrls)];
    _channelsSignature = signature;

    if (fetchedChannels.length > 0) {
      const epgUrls = _detectedEpgUrls;
      const savedAt = Date.now();
      await saveChannelsCache(signature, savedAt, epgUrls, fetchedChannels);
    }
  }

  refreshEpg(false);
}

/**
 * Builds EPG requests from current state
 * @param {LiveTvUiState} state
 * @returns {EpgRequest[]}
 */
function buildEpgRequests(state) {
  const urls = new Map();

  // Manual EPG sources
  state.epgSources
    .filter((s) => s.isEnabled)
    .forEach((source) => {
      urls.set(source.url, source.name);
    });

  // Auto-detected EPG URLs
  if (state.isEpgAutoDetectEnabled) {
    _detectedEpgUrls.forEach((url) => urls.set(url, epgSourceNameFromUrl(url)));
    if (isXtreamConfigured(state.xtreamSettings) && state.xtreamSettings.isEnabled) {
      urls.set(xtreamEpgUrl(state.xtreamSettings), "Xtream");
    }
    // Stalker EPG handled separately
  }

  const requests = [];
  for (const [url, label] of urls) {
    requests.push({
      cacheKey: `xmltv:${url}`,
      label,
      load: (nowMillis) => fetchXmltvGuide(url, nowMillis)
    });
  }

  // Stalker EPG
  const stalkerSettings = state.stalkerSettings;
  if (
    state.isEpgAutoDetectEnabled &&
    isStalkerConfigured(stalkerSettings) &&
    stalkerSettings.isEnabled
  ) {
    requests.push({
      cacheKey: `stalker:${stalkerSettings.portalUrl}:${stalkerSettings.macAddress}`,
      label: "Stalker Portal",
      load: (nowMillis) =>
        fetchStalkerEpgGuide(
          stalkerSettings,
          nowMillis - LIVE_TV_EPG_PAST_WINDOW_MILLIS,
          nowMillis + LIVE_TV_EPG_FUTURE_WINDOW_MILLIS
        )
    });
  }

  return requests;
}

/**
 * Refreshes EPG data
 * @param {boolean} force
 */
async function refreshEpg(force = true) {
  const state = _uiState;
  const requests = buildEpgRequests(state);

  if (_epgAbortController) _epgAbortController.abort();
  _epgAbortController = new AbortController();

  // Clean up cache
  const validCacheKeys = new Set(requests.map((r) => r.cacheKey));
  for (const key of _epgGuideCache.keys()) {
    if (!validCacheKeys.has(key)) _epgGuideCache.delete(key);
  }

  if (state.channels.length === 0 || requests.length === 0) {
    setUiState({ epgPrograms: {}, isEpgLoading: false, epgErrorMessage: null });
    return;
  }

  if (!force && applyRestoredEpg()) return;

  const epgSignature = liveTvEpgSignature(state, requests);
  setUiState({ isEpgLoading: true, epgErrorMessage: null });

  try {
    const nowMillis = Date.now();
    const guides = [];
    const failedGuideNames = [];

    const requestPromises = requests.map(async (request) => {
      const cached = _epgGuideCache.get(request.cacheKey);
      if (cached && !force && nowMillis - cached.loadedAtMillis < LIVE_TV_EPG_CACHE_TTL_MILLIS) {
        return { guide: cached.guide, error: null };
      }
      try {
        const guide = await request.load(nowMillis);
        return { guide, error: null };
      } catch (error) {
        if (_epgAbortController.signal.aborted) throw error;
        return { guide: null, error };
      }
    });

    const results = await Promise.all(requestPromises);

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      const result = results[i];
      if (result.error) {
        failedGuideNames.push(request.label);
        console.warn("Failed to load live TV guide", request.label, result.error);
      } else {
        _epgGuideCache.set(request.cacheKey, { guide: result.guide, loadedAtMillis: nowMillis });
        guides.push(result.guide);
      }
    }

    const channels = _uiState.channels;
    const programs = matchEpgToChannels(channels, guides);

    setUiState({
      epgPrograms: programs,
      isEpgLoading: false,
      epgErrorMessage:
        failedGuideNames.length > 0
          ? `Some guides could not be loaded: ${failedGuideNames.join(", ")}`
          : null
    });

    if (Object.keys(programs).length > 0) {
      _restoredEpg = { signature: epgSignature, savedAtMillis: nowMillis, programs };
      await saveEpgCache(epgSignature, nowMillis, programs);
    }
  } catch (error) {
    if (!_epgAbortController.signal.aborted) {
      setUiState({ isEpgLoading: false, epgErrorMessage: error.message });
    }
  }
}

/**
 * Applies restored EPG from cache if valid
 * @returns {boolean}
 */
function applyRestoredEpg() {
  const state = _uiState;
  const restored = _restoredEpg;
  if (!restored || state.channels.length === 0) return false;

  const requests = buildEpgRequests(state);
  if (requests.length === 0) return false;

  if (restored.signature !== liveTvEpgSignature(state, requests)) return false;
  if (Date.now() - restored.savedAtMillis >= LIVE_TV_EPG_CACHE_TTL_MILLIS) return false;

  setUiState({
    epgPrograms: restored.programs,
    isEpgLoading: false,
    epgErrorMessage: null
  });
  return true;
}

/**
 * Generates EPG signature for cache validation
 * @param {LiveTvUiState} state
 * @param {EpgRequest[]} requests
 * @returns {string}
 */
function liveTvEpgSignature(state, requests) {
  return liveTvChannelSourceSignature(state) + "#" + requests.map((r) => r.cacheKey).join("|");
}

/**
 * Generates channel source signature for cache validation
 * @param {LiveTvUiState} state
 * @returns {string}
 */
function liveTvChannelSourceSignature(state) {
  const parts = [];
  state.playlists
    .filter((p) => p.isEnabled)
    .forEach((p) => {
      parts.push(`${p.type}:${p.source}`);
    });
  if (isXtreamConfigured(state.xtreamSettings) && state.xtreamSettings.isEnabled) {
    parts.push(`xtream:${state.xtreamSettings.serverUrl}:${state.xtreamSettings.username}`);
  }
  if (isStalkerConfigured(state.stalkerSettings) && state.stalkerSettings.isEnabled) {
    parts.push(`stalker:${state.stalkerSettings.portalUrl}:${state.stalkerSettings.macAddress}`);
  }
  return parts.join("|");
}

/**
 * Matches EPG guides to channels
 * @param {LiveTvChannel[]} channels
 * @param {LiveTvEpgGuide[]} guides
 * @returns {Object<string, LiveTvEpgProgram[]>}
 */
function matchEpgToChannels(channels, guides) {
  if (guides.length === 0 || channels.length === 0) return {};

  const result = {};
  for (const channel of channels) {
    const epgKey = channel.epgId?.trim() ? liveTvEpgKey(channel.epgId) : null;
    const nameKey = normalizeEpgChannelName(channel.name);

    let programs = null;

    // Match by channel ID
    programs = guides.find((g) => g.programsByChannelId[channel.id])?.programsByChannelId[
      channel.id
    ];

    // Match by EPG key
    if (!programs && epgKey) {
      programs = guides.find((g) => g.programsByEpgKey[epgKey])?.programsByEpgKey[epgKey];
    }

    // Match by EPG ID name candidates
    if (!programs && epgKey) {
      const candidates = epgIdNameCandidates(epgKey);
      for (const candidate of candidates) {
        programs = guides.find(
          (g) => g.epgKeysByName[candidate] && g.programsByEpgKey[g.epgKeysByName[candidate]]
        );
        if (programs) break;
      }
    }

    // Match by normalized name
    if (!programs && nameKey) {
      programs = guides.find(
        (g) => g.epgKeysByName[nameKey] && g.programsByEpgKey[g.epgKeysByName[nameKey]]
      );
    }

    if (programs && programs.length > 0) {
      result[channel.id] = programs;
    }
  }
  return result;
}

// ==================== M3U Parsing ====================

/**
 * Parses M3U for EPG URLs
 * @param {string} payload
 * @returns {string[]}
 */
function parseM3uEpgUrls(payload) {
  const lines = payload
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l);
  const header = lines[0];
  if (!header?.toLowerCase().startsWith("#extm3u")) return [];

  const keys = ["url-tvg", "x-tvg-url", "tvg-url"];
  const urls = [];
  for (const key of keys) {
    const value = readM3uAttribute(header, key);
    if (value) {
      urls.push(
        ...value
          .split(",")
          .map((v) => v.trim())
          .filter(
            (v) => v.toLowerCase().startsWith("http://") || v.toLowerCase().startsWith("https://")
          )
      );
    }
  }
  return [...new Set(urls)];
}

/**
 * Parses M3U playlist into channels
 * @param {string} payload
 * @param {LiveTvPlaylist} [playlist]
 * @returns {[string[], LiveTvChannel[]]}
 */
async function parseM3uPlaylist(payload, playlist = null) {
  const epgUrls = parseM3uEpgUrls(payload);
  const channels = [];
  let pendingInfo = null;

  for (const line of payload
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l)) {
    if (line.toLowerCase().startsWith("#extinf")) {
      pendingInfo = parseExtInf(line);
    } else if (line.startsWith("#")) {
      continue;
    } else {
      const streamUrl = line;
      const info = pendingInfo;
      const name = info?.name?.trim() || streamUrl.split("/").pop()?.split("?")[0] || "Channel";

      channels.push(
        createLiveTvChannel({
          id: stableChannelId(streamUrl, channels.length),
          name,
          streamUrl,
          logoUrl: info?.logoUrl || null,
          group: info?.group || null,
          playlistId: playlist?.id || null,
          playlistName: playlist?.name || null,
          epgId: info?.epgId || null
        })
      );
      pendingInfo = null;
    }
  }

  // Deduplicate by streamUrl
  const unique = channels.filter(
    (ch, i, arr) => arr.findIndex((c) => c.streamUrl === ch.streamUrl) === i
  );
  return [epgUrls, unique];
}

/**
 * Parses EXTINF line
 * @param {string} line
 * @returns {M3uInfo|null}
 */
function parseExtInf(line) {
  const name =
    line.substring(line.indexOf(",") + 1).trim() || readM3uAttribute(line, "tvg-name") || "";

  return {
    name,
    logoUrl: readM3uAttribute(line, "tvg-logo"),
    group: readM3uAttribute(line, "group-title"),
    epgId: readM3uAttribute(line, "tvg-id")
  };
}

/**
 * Reads M3U attribute value
 * @param {string} line
 * @param {string} key
 * @returns {string|null}
 */
function readM3uAttribute(line, key) {
  const marker = `${key}="`;
  const start = line.toLowerCase().indexOf(marker.toLowerCase());
  if (start < 0) return null;
  const valueStart = start + marker.length;
  const valueEnd = line.indexOf('"', valueStart);
  if (valueEnd < 0) return null;
  return line.substring(valueStart, valueEnd).trim();
}

// ==================== XMLTV EPG Parsing ====================

/**
 * Downloads and parses XMLTV guide
 * @param {string} url
 * @param {number} nowMillis
 * @returns {Promise<LiveTvEpgGuide>}
 */
async function fetchXmltvGuide(url, nowMillis) {
  const xml = await downloadXmltv(url);
  return parseXmltvGuide(
    xml,
    nowMillis - LIVE_TV_EPG_PAST_WINDOW_MILLIS,
    nowMillis + LIVE_TV_EPG_FUTURE_WINDOW_MILLIS
  );
}

/**
 * Downloads XMLTV (handles gzip)
 * @param {string} url
 * @returns {Promise<string>}
 */
async function downloadXmltv(url) {
  const cleanUrl = url.split("#")[0].split("?")[0];
  if (!cleanUrl.toLowerCase().endsWith(".gz")) {
    const text = await fetchText(url);
    if (!text.startsWith("\u001F")) return text; // Not gzip
  }

  const response = await fetch(url, { headers: EPG_REQUEST_HEADERS });
  if (!response.ok) throw new Error(`Guide request failed with HTTP ${response.status}`);

  const bytes = await response.arrayBuffer();
  const uint8 = new Uint8Array(bytes);
  const isGzip = uint8.length >= 2 && uint8[0] === 0x1f && uint8[1] === 0x8b;

  let xmlBytes = uint8;
  if (isGzip) {
    xmlBytes = await gunzip(uint8);
  }

  return new TextDecoder().decode(xmlBytes);
}

/**
 * Simple gunzip implementation (for small files)
 * @param {Uint8Array} bytes
 * @returns {Promise<Uint8Array>}
 */
async function gunzip(bytes) {
  // Use browser's built-in decompression
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const reader = ds.readable.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/**
 * Parses XMLTV guide
 * @param {string} xml
 * @param {number} windowStartMillis
 * @param {number} windowEndMillis
 * @returns {LiveTvEpgGuide}
 */
function parseXmltvGuide(xml, windowStartMillis, windowEndMillis) {
  const keysByName = new Map();
  const idKeysByName = new Map();
  let index = 0;

  // Parse channels
  while (true) {
    const start = xml.indexOf("<channel", index);
    if (start < 0) break;
    if (!isXmlTagBoundary(xml[start + 8])) {
      index = start + 8;
      continue;
    }
    const tagEnd = xml.indexOf(">", start);
    if (tagEnd < 0) break;
    const openTag = xml.substring(start, tagEnd);
    const selfClosing = openTag.endsWith("/");
    const close = selfClosing ? tagEnd : xml.indexOf("</channel>", tagEnd);
    if (close < 0) break;
    index = close + 1;

    const id = readXmlAttribute(openTag, "id");
    if (!id) continue;
    const decodedId = decodeXmlEntities(id).trim();
    if (!decodedId) continue;
    const key = liveTvEpgKey(decodedId);

    if (!selfClosing) {
      const channelBody = xml.substring(tagEnd + 1, close);
      const displayNames = readXmlElementTexts(channelBody, "display-name");
      for (const name of displayNames) {
        const normalized = normalizeEpgChannelName(name);
        if (normalized) keysByName.set(normalized, key);
      }
    }
    for (const candidate of epgIdNameCandidates(decodedId)) {
      idKeysByName.set(candidate, key);
    }
  }

  // Parse programmes
  const programs = new Map();
  index = 0;
  while (true) {
    const start = xml.indexOf("<programme", index);
    if (start < 0) break;
    if (!isXmlTagBoundary(xml[start + 10])) {
      index = start + 10;
      continue;
    }
    const tagEnd = xml.indexOf(">", start);
    if (tagEnd < 0) break;
    const openTag = xml.substring(start, tagEnd);
    const selfClosing = openTag.endsWith("/");
    const close = selfClosing ? tagEnd : xml.indexOf("</programme>", tagEnd);
    if (close < 0) break;
    index = close + 1;
    if (selfClosing) continue;

    const channel = readXmlAttribute(openTag, "channel");
    if (!channel) continue;
    const decodedChannel = decodeXmlEntities(channel).trim();
    if (!decodedChannel) continue;

    const startMillis = parseXmltvTime(readXmlAttribute(openTag, "start"));
    const stopMillis = parseXmltvTime(readXmlAttribute(openTag, "stop"));
    if (startMillis === null) continue;
    if (startMillis > windowEndMillis) continue;
    if (stopMillis !== null && stopMillis < windowStartMillis) continue;

    const body = xml.substring(tagEnd + 1, close);
    const titles = readXmlElementTexts(body, "title", 1);
    if (titles.length === 0) continue;

    const key = liveTvEpgKey(decodedChannel);
    if (!programs.has(key)) programs.set(key, []);
    programs.get(key).push(
      createLiveTvEpgProgram({
        title: titles[0],
        startMillis,
        endMillis: stopMillis ?? -1,
        description: readXmlElementTexts(body, "desc", 1)[0] || null,
        category: readXmlElementTexts(body, "category", 1)[0] || null
      })
    );
  }

  // Finalize programs
  const finalized = new Map();
  for (const [key, list] of programs) {
    const sorted = list.sort((a, b) => a.startMillis - b.startMillis);
    const seen = new Set();
    const distinct = [];
    for (const p of sorted) {
      if (!seen.has(p.startMillis)) {
        seen.add(p.startMillis);
        distinct.push(p);
      }
    }

    const finalizedList = distinct
      .map((p, i) => {
        if (p.endMillis > p.startMillis) return p;
        const nextStart = distinct[i + 1]?.startMillis;
        return { ...p, endMillis: nextStart ?? p.startMillis + 60 * 60 * 1000 };
      })
      .filter((p) => p.endMillis >= windowStartMillis);

    if (finalizedList.length > 0) finalized.set(key, finalizedList);
  }

  // Merge ID keys into name keys
  for (const [name, key] of idKeysByName) {
    if (finalized.has(key)) keysByName.set(name, key);
  }

  // Build programsByChannelId map
  const programsByChannelId = new Map();
  for (const [key, progs] of finalized) {
    // This would need channel ID mapping; simplified for now
  }

  return {
    programsByEpgKey: Object.fromEntries(finalized),
    epgKeysByName: Object.fromEntries(keysByName),
    programsByChannelId: Object.fromEntries(programsByChannelId)
  };
}

/**
 * Finalizes EPG programs (sets end times from next program)
 * @param {LiveTvEpgProgram[]} programs
 * @param {number} windowStartMillis
 * @returns {LiveTvEpgProgram[]}
 */
function finalizeEpgPrograms(programs, windowStartMillis) {
  const sorted = programs
    .sort((a, b) => a.startMillis - b.startMillis)
    .filter((p, i, arr) => i === 0 || p.startMillis !== arr[i - 1].startMillis);

  return sorted
    .map((p, i) => {
      if (p.endMillis > p.startMillis) return p;
      const nextStart = sorted[i + 1]?.startMillis;
      return { ...p, endMillis: nextStart ?? p.startMillis + 60 * 60 * 1000 };
    })
    .filter((p) => p.endMillis >= windowStartMillis);
}

// XML parsing helpers
function isXmlTagBoundary(char) {
  return !char || char === ">" || char === "/" || /\s/.test(char);
}

function readXmlAttribute(tag, name) {
  let from = 0;
  while (true) {
    const index = tag.indexOf(name, from);
    if (index < 0) return null;
    let cursor = index + name.length;
    const before = tag[index - 1];
    if (before && !/\s/.test(before)) {
      from = cursor;
      continue;
    }
    while (cursor < tag.length && /\s/.test(tag[cursor])) cursor++;
    if (tag[cursor] !== "=") {
      from = index + name.length;
      continue;
    }
    cursor++;
    while (cursor < tag.length && /\s/.test(tag[cursor])) cursor++;
    const quote = tag[cursor];
    if (quote !== '"' && quote !== "'") {
      from = cursor;
      continue;
    }
    const end = tag.indexOf(quote, cursor + 1);
    if (end < 0) return null;
    return tag.substring(cursor + 1, end);
  }
}

function readXmlElementTexts(body, name, limit = Infinity) {
  const results = [];
  const open = `<${name}`;
  const close = `</${name}>`;
  let index = 0;
  while (results.length < limit) {
    const start = body.indexOf(open, index);
    if (start < 0) break;
    if (!isXmlTagBoundary(body[start + open.length])) {
      index = start + open.length;
      continue;
    }
    const tagEnd = body.indexOf(">", start);
    if (tagEnd < 0) break;
    if (body[tagEnd - 1] === "/") {
      index = tagEnd + 1;
      continue;
    }
    const end = body.indexOf(close, tagEnd);
    if (end < 0) break;
    const text = decodeXmlText(body.substring(tagEnd + 1, end)).trim();
    if (text) results.push(text);
    index = end + close.length;
  }
  return results;
}

function decodeXmlText(raw) {
  if (!raw.includes("<![CDATA[")) return decodeXmlEntities(raw);
  const builder = [];
  let index = 0;
  while (index < raw.length) {
    const cdataStart = raw.indexOf("<![CDATA[", index);
    if (cdataStart < 0) {
      builder.push(decodeXmlEntities(raw.substring(index)));
      break;
    }
    builder.push(decodeXmlEntities(raw.substring(index, cdataStart)));
    const contentStart = cdataStart + 9;
    const cdataEnd = raw.indexOf("]]>", contentStart);
    if (cdataEnd < 0) {
      builder.push(raw.substring(contentStart));
      break;
    }
    builder.push(raw.substring(contentStart, cdataEnd));
    index = cdataEnd + 3;
  }
  return builder.join("");
}

function decodeXmlEntities(value) {
  if (!value.includes("&")) return value;
  const builder = [];
  let index = 0;
  while (index < value.length) {
    if (value[index] === "&") {
      const semicolon = value.indexOf(";", index + 1);
      if (semicolon > index && semicolon - index <= 10) {
        const entity = value.substring(index + 1, semicolon);
        let decoded = null;
        if (entity === "amp") decoded = "&";
        else if (entity === "lt") decoded = "<";
        else if (entity === "gt") decoded = ">";
        else if (entity === "quot") decoded = '"';
        else if (entity === "apos") decoded = "'";
        else if (entity.startsWith("#x") || entity.startsWith("#X")) {
          const code = parseInt(entity.substring(2), 16);
          if (!isNaN(code)) decoded = String.fromCodePoint(code);
        } else if (entity.startsWith("#")) {
          const code = parseInt(entity.substring(1), 10);
          if (!isNaN(code)) decoded = String.fromCodePoint(code);
        }
        if (decoded !== null) {
          builder.push(decoded);
          index = semicolon + 1;
          continue;
        }
      }
    }
    builder.push(value[index]);
    index++;
  }
  return builder.join("");
}

function parseXmltvTime(value) {
  if (!value) return null;
  const trimmed = value.trim();
  const digits = trimmed.match(/^\d+/)?.[0];
  if (!digits || digits.length < 12) return null;

  const year = parseInt(digits.substring(0, 4));
  const month = parseInt(digits.substring(4, 6));
  const day = parseInt(digits.substring(6, 8));
  const hour = parseInt(digits.substring(8, 10));
  const minute = parseInt(digits.substring(10, 12));
  const second = digits.length >= 14 ? parseInt(digits.substring(12, 14)) : 0;
  if (!year || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59)
    return null;

  const rest = trimmed.substring(digits.length).trim();
  let offsetMinutes = 0;
  if (rest.length >= 5 && (rest[0] === "+" || rest[0] === "-")) {
    const offsetDigits = rest.substring(1).replace(/\D/g, "");
    const offsetHours = parseInt(offsetDigits.substring(0, 2));
    const offsetMins = parseInt(offsetDigits.substring(2, 4)) || 0;
    if (!isNaN(offsetHours)) {
      offsetMinutes = (offsetHours * 60 + offsetMins) * (rest[0] === "-" ? -1 : 1);
    }
  }

  const epochDays = epgDaysFromCivil(year, month, day);
  const epochSeconds = epochDays * 86400 + hour * 3600 + minute * 60 + second - offsetMinutes * 60;
  return epochSeconds * 1000;
}

function epgDaysFromCivil(year, month, day) {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor((y >= 0 ? y : y - 399) / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.floor((153 * (month > 2 ? month - 3 : month + 9) + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

// ==================== Xtream Codes ====================

/**
 * Fetches channels from Xtream Codes API
 * @param {LiveTvXtreamSettings} settings
 * @param {AbortSignal} signal
 * @returns {Promise<LiveTvChannel[]>}
 */
async function fetchXtreamChannels(settings, signal) {
  const normalized = {
    serverUrl: settings.serverUrl
      .trim()
      .replace(/\/+$/, "")
      .replace(/\/player_api\.php.*$/, ""),
    username: settings.username.trim(),
    password: settings.password.trim()
  };

  const categories = new Map();
  const catResponse = await xtreamRequest(normalized, "get_live_categories", signal);
  if (Array.isArray(catResponse)) {
    for (const item of catResponse) {
      const id = item.category_id || item.id;
      const name = item.category_name || item.name || id;
      if (id) categories.set(id, name);
    }
  }

  const streamsResponse = await xtreamRequest(normalized, "get_live_streams", signal);
  if (!Array.isArray(streamsResponse)) return [];

  const channels = [];
  for (let i = 0; i < streamsResponse.length; i++) {
    const item = streamsResponse[i];
    const name = item.name;
    const streamId = item.stream_id || item.id;
    if (!name || !streamId) continue;

    const extension = (item.container_extension?.trim()?.replace(/^\./, "") || "ts").toLowerCase();
    const directSource = item.direct_source?.match(/^https?:\/\//) ? item.direct_source : null;

    channels.push(
      createLiveTvChannel({
        id: `xtream:${streamId}`,
        name,
        streamUrl:
          directSource ||
          `${normalized.serverUrl}/live/${encodeURIComponent(normalized.username)}/${encodeURIComponent(normalized.password)}/${encodeURIComponent(streamId)}.${extension}`,
        logoUrl: item.stream_icon || item.logo || null,
        group: item.category_id ? categories.get(item.category_id) : null,
        playlistId: "provider:xtream",
        playlistName: "Xtream",
        headers: STREAM_REQUEST_HEADERS,
        streamType: extension,
        epgId: item.epg_channel_id || null
      })
    );
  }

  return channels.filter((ch, i, arr) => arr.findIndex((c) => c.streamUrl === ch.streamUrl) === i);
}

/**
 * Makes Xtream API request
 * @param {Object} settings
 * @param {string} action
 * @param {AbortSignal} signal
 * @returns {Promise<any>}
 */
async function xtreamRequest(settings, action, signal) {
  const url = `${settings.serverUrl}/player_api.php?username=${encodeURIComponent(settings.username)}&password=${encodeURIComponent(settings.password)}&action=${encodeURIComponent(action)}`;
  const response = await fetch(url, { headers: PLAYLIST_REQUEST_HEADERS, signal });
  if (!response.ok) throw new Error(`Xtream request failed: ${response.status}`);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

/**
 * Builds Xtream EPG URL
 * @param {LiveTvXtreamSettings} settings
 * @returns {string}
 */
function xtreamEpgUrl(settings) {
  const normalized = {
    serverUrl: settings.serverUrl
      .trim()
      .replace(/\/+$/, "")
      .replace(/\/player_api\.php.*$/, ""),
    username: settings.username.trim(),
    password: settings.password.trim()
  };
  return `${normalized.serverUrl}/xmltv.php?username=${encodeURIComponent(normalized.username)}&password=${encodeURIComponent(normalized.password)}`;
}

// ==================== Stalker Portal ====================

let _cachedStalkerSession = null;

/**
 * Fetches channels from Stalker Portal
 * @param {LiveTvStalkerSettings} settings
 * @param {AbortSignal} signal
 * @returns {Promise<LiveTvChannel[]>}
 */
async function fetchStalkerChannels(settings, signal) {
  const session = await stalkerSession(settings, signal);
  const genres = new Map();

  const genresData = await stalkerRequest(
    session.settings,
    session.token,
    "itv",
    "get_genres",
    {},
    signal
  );
  if (genresData?.js?.data) {
    for (const item of genresData.js.data) {
      const id = item.id || item.alias;
      const name = item.title || item.name || id;
      if (id) genres.set(id, name);
    }
  }

  const channels = [];
  for (let page = 1; page <= 20; page++) {
    const data = await stalkerRequest(
      session.settings,
      session.token,
      "itv",
      "get_ordered_list",
      { p: page.toString() },
      signal
    );
    const items = data?.js?.data || [];
    if (items.length === 0) break;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const command = item.cmd || item.mc_cmd || item.url;
      if (!command) continue;
      const url = playableUrl(command);
      if (!url) continue;

      channels.push(
        createLiveTvChannel({
          id: `stalker:${item.id || `${page}:${i}`}`,
          name: item.name || item.title,
          streamUrl: url,
          logoUrl: item.logo || item.logo_url || null,
          group:
            item.tv_genre_id || item.genre_id
              ? genres.get(item.tv_genre_id || item.genre_id)
              : null,
          playlistId: "provider:stalker",
          playlistName: "Stalker Portal",
          headers: stalkerHeaders(session.settings, session.token),
          stalkerCommand: command,
          epgId: item.xmltv_id || null
        })
      );
    }
  }

  return channels.filter((ch, i, arr) => arr.findIndex((c) => c.id === ch.id) === i);
}

/**
 * Fetches EPG from Stalker Portal
 * @param {LiveTvStalkerSettings} settings
 * @param {number} windowStartMillis
 * @param {number} windowEndMillis
 * @returns {Promise<LiveTvEpgGuide>}
 */
async function fetchStalkerEpgGuide(settings, windowStartMillis, windowEndMillis) {
  const session = await stalkerSession(settings);
  const data = await stalkerRequest(session.settings, session.token, "itv", "get_epg_info", {
    period: "48"
  });
  const epgData = data?.js?.data;
  if (!epgData) return { programsByChannelId: {} };

  const programsByChannelId = {};
  for (const [channelId, element] of Object.entries(epgData)) {
    if (!Array.isArray(element)) continue;
    const items = [];
    for (const entry of element) {
      const title = entry.name;
      const start = entry.start_timestamp ? parseInt(entry.start_timestamp) * 1000 : null;
      const stop = entry.stop_timestamp ? parseInt(entry.stop_timestamp) * 1000 : null;
      if (!title || start === null || stop === null) continue;
      if (stop < windowStartMillis || start > windowEndMillis) continue;
      items.push(
        createLiveTvEpgProgram({
          title,
          startMillis: start,
          endMillis: stop,
          description: entry.descr || null,
          category: entry.category || null
        })
      );
    }
    if (items.length > 0) {
      programsByChannelId[`stalker:${channelId}`] = items.sort(
        (a, b) => a.startMillis - b.startMillis
      );
    }
  }

  return { programsByChannelId };
}

/**
 * Prepares Stalker channel for playback (resolves dynamic link)
 * @param {LiveTvChannel} channel
 * @param {LiveTvStalkerSettings} settings
 * @returns {Promise<LiveTvChannel>}
 */
async function preparePortalChannelForPlayback(channel, settings) {
  if (!channel.stalkerCommand) return channel;
  const session = await stalkerSession(settings);
  const result = await stalkerRequest(session.settings, session.token, "itv", "create_link", {
    cmd: channel.stalkerCommand
  });
  const url = playableUrl(result.cmd || result.url || result.stream_url || "");
  return {
    ...channel,
    streamUrl: url || channel.streamUrl,
    headers: { ...channel.headers, ...stalkerHeaders(session.settings, session.token) }
  };
}

/**
 * Gets or creates Stalker session
 * @param {LiveTvStalkerSettings} settings
 * @param {AbortSignal} [signal]
 * @returns {Promise<{settings, token}>}
 */
async function stalkerSession(settings, signal = null) {
  const normalized = {
    portalUrl: settings.portalUrl.trim().replace(/\/+$/, ""),
    macAddress: settings.macAddress.trim().toUpperCase(),
    username: settings.username.trim(),
    password: settings.password.trim()
  };

  if (
    _cachedStalkerSession &&
    _cachedStalkerSession.settings.portalUrl === normalized.portalUrl &&
    _cachedStalkerSession.settings.macAddress === normalized.macAddress &&
    _cachedStalkerSession.settings.username === normalized.username &&
    _cachedStalkerSession.token
  ) {
    return _cachedStalkerSession;
  }

  const handshake = await stalkerRequest(normalized, null, "stb", "handshake", {}, signal);
  const token = handshake?.js?.token || handshake?.token || "";
  if (!token) throw new Error("Stalker Portal did not return an authorization token.");

  _cachedStalkerSession = { settings: normalized, token };
  return _cachedStalkerSession;
}

/**
 * Makes Stalker Portal request
 * @param {Object} settings
 * @param {string|null} token
 * @param {string} type
 * @param {string} action
 * @param {Object} extra
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>}
 */
async function stalkerRequest(settings, token, type, action, extra = {}, signal = null) {
  const params = {
    type,
    action,
    JsHttpRequest: "1-xml",
    ...(token ? { token } : {}),
    ...(settings.username ? { login: settings.username } : {}),
    ...(settings.password ? { password: settings.password } : {}),
    ...extra
  };

  const endpoint = portalEndpoint(settings);
  const query = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  const separator = endpoint.includes("?") ? "&" : "?";

  const response = await fetch(`${endpoint}${separator}${query}`, {
    headers: stalkerHeaders(settings, token),
    signal
  });
  if (!response.ok) throw new Error(`Stalker request failed: ${response.status}`);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function portalEndpoint(settings) {
  const normalized = settings.portalUrl.trim().replace(/\/+$/, "");
  if (normalized.toLowerCase().includes("portal.php")) return normalized;
  if (normalized.toLowerCase().includes("server/load.php")) return normalized;
  if (normalized.toLowerCase().endsWith("/c")) return normalized.slice(0, -2) + "/portal.php";
  return `${normalized}/portal.php`;
}

function portalBaseUrl(settings) {
  const base = settings.portalUrl
    .trim()
    .replace(/\/portal\.php.*$/i, "")
    .replace(/\/server\/load\.php.*$/i, "")
    .replace(/\/+$/, "")
    .replace(/\/c$/i, "");
  return `${base}/c/`;
}

function stalkerHeaders(settings, token) {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (QtEmbedded; U; Linux; MAG254; en) AppleWebKit/533.3 MAG200 stbapp ver: 4 rev: 2721 Mobile Safari/533.3",
    "X-User-Agent": "Model: MAG254; Link: Ethernet",
    Referer: portalBaseUrl(settings),
    Cookie: `mac=${settings.macAddress}; stb_lang=en; timezone=Europe%2FIstanbul`
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

function playableUrl(str) {
  if (!str) return "";
  return str
    .trim()
    .replace(/^ffmpeg\s+/i, "")
    .replace(/^auto\s+/i, "")
    .split(" ")[0]
    .trim();
}

// ==================== Storage ====================

function loadSavedPlaylists() {
  const blob = LocalStore.get(STORAGE_KEYS.PLAYLISTS_BLOB, "");
  const decoded = blob ? decodePlaylists(blob) : [];
  if (decoded.length > 0) return decoded;

  const legacyUrl = LocalStore.get(STORAGE_KEYS.PLAYLIST_URL, "")?.trim() || "";
  if (legacyUrl) return [createUrlPlaylist(legacyUrl)];

  // Default playlist for testing
  const defaultPlaylist = createUrlPlaylist(
    "https://iptv-org.github.io/iptv/languages/por.m3u",
    "IPTV Português"
  );
  return [defaultPlaylist];
}

function persistPlaylists(playlists) {
  LocalStore.set(STORAGE_KEYS.PLAYLISTS_BLOB, encodePlaylists(playlists));
  const urlSource = playlists.find((p) => p.type === "url")?.source || "";
  LocalStore.set(STORAGE_KEYS.PLAYLIST_URL, urlSource);
}

function loadFavoriteChannelIds() {
  const blob = LocalStore.get(STORAGE_KEYS.FAVORITE_CHANNELS_BLOB, "");
  return new Set(
    blob
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s)
  );
}

function persistFavoriteChannelIds(channelIds) {
  LocalStore.set(STORAGE_KEYS.FAVORITE_CHANNELS_BLOB, [...channelIds].sort().join("\n"));
}

function loadLastWatchedChannelId() {
  return LocalStore.get(STORAGE_KEYS.LAST_WATCHED_CHANNEL, null);
}

function saveLastWatchedChannelId(channelId) {
  LocalStore.set(STORAGE_KEYS.LAST_WATCHED_CHANNEL, channelId);
}

function loadNavigationEnabled() {
  const val = LocalStore.get(STORAGE_KEYS.NAVIGATION_ENABLED, null);
  return val === null ? null : val === true || val === "true";
}

function saveNavigationEnabled(enabled) {
  LocalStore.set(STORAGE_KEYS.NAVIGATION_ENABLED, enabled);
}

function loadStalkerSettings() {
  return LocalStore.get(STORAGE_KEYS.STALKER_SETTINGS, createDefaultStalkerSettings());
}

function saveStalkerSettingsToStorage(settings) {
  LocalStore.set(STORAGE_KEYS.STALKER_SETTINGS, settings);
}

function loadXtreamSettings() {
  return LocalStore.get(STORAGE_KEYS.XTREAM_SETTINGS, createDefaultXtreamSettings());
}

function saveXtreamSettingsToStorage(settings) {
  LocalStore.set(STORAGE_KEYS.XTREAM_SETTINGS, settings);
}

function loadEpgSourcesBlob() {
  return LocalStore.get(STORAGE_KEYS.EPG_SOURCES_BLOB, "");
}

function updateEpgSources(sources) {
  LocalStore.set(STORAGE_KEYS.EPG_SOURCES_BLOB, encodeEpgSources(sources));
  setUiState({ epgSources: sources });
  refreshEpg(false);
}

function loadEpgAutoDetectEnabled() {
  const val = LocalStore.get(STORAGE_KEYS.EPG_AUTO_DETECT, null);
  return val === null ? null : val === true || val === "true";
}

function saveEpgAutoDetectEnabled(enabled) {
  LocalStore.set(STORAGE_KEYS.EPG_AUTO_DETECT, enabled);
}

function publishNavigationVisibility() {
  // Could dispatch custom event for sidebar to listen
  window.dispatchEvent(
    new CustomEvent("livetv:navigation-visibility", {
      detail: { visible: shouldShowInNavigation(_uiState) }
    })
  );
}

// ==================== Cache ====================

async function saveChannelsCache(signature, savedAt, epgUrls, channels) {
  LocalStore.set(
    STORAGE_KEYS.CHANNELS_CACHE,
    JSON.stringify({ signature, savedAt, epgUrls, channels })
  );
}

async function loadChannelsCache() {
  const data = LocalStore.get(STORAGE_KEYS.CHANNELS_CACHE, null);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function saveEpgCache(signature, savedAt, programs) {
  LocalStore.set(STORAGE_KEYS.EPG_CACHE, JSON.stringify({ signature, savedAt, programs }));
}

async function loadEpgCache() {
  const data = LocalStore.get(STORAGE_KEYS.EPG_CACHE, null);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// ==================== Serialization ====================

function escapeField(value) {
  return String(value)
    .replace(/%/g, "%25")
    .replace(new RegExp(RECORD_SEPARATOR, "g"), "%1E")
    .replace(new RegExp(FIELD_SEPARATOR, "g"), "%1F");
}

function unescapeField(value) {
  return String(value)
    .replace(/%1F/g, FIELD_SEPARATOR)
    .replace(/%1E/g, RECORD_SEPARATOR)
    .replace(/%25/g, "%");
}

function encodePlaylists(playlists) {
  return playlists
    .map((p) =>
      [p.id, p.name, p.type, p.source, p.isEnabled.toString()]
        .map(escapeField)
        .join(FIELD_SEPARATOR)
    )
    .join(RECORD_SEPARATOR);
}

function decodePlaylists(blob) {
  if (!blob) return [];
  return blob
    .split(RECORD_SEPARATOR)
    .filter((r) => r)
    .map((r) => {
      const fields = r.split(FIELD_SEPARATOR).map(unescapeField);
      return createLiveTvPlaylist({
        id: fields[0],
        name: fields[1] || "M3U playlist",
        type: fields[2],
        source: fields[3] || "",
        isEnabled: fields[4] !== "false"
      });
    })
    .filter((p) => p.id && p.source);
}

function encodeEpgSources(sources) {
  return sources
    .map((s) =>
      [s.id, s.name, s.url, s.isEnabled.toString()].map(escapeField).join(FIELD_SEPARATOR)
    )
    .join(RECORD_SEPARATOR);
}

function decodeEpgSources(blob) {
  if (!blob) return [];
  return blob
    .split(RECORD_SEPARATOR)
    .filter((r) => r)
    .map((r) => {
      const fields = r.split(FIELD_SEPARATOR).map(unescapeField);
      const url = fields[2];
      if (!url) return null;
      return createLiveTvEpgSource({
        id: fields[0],
        name: fields[1] || epgSourceNameFromUrl(url),
        url,
        isEnabled: fields[3] !== "false"
      });
    })
    .filter(Boolean);
}

function epgSourceNameFromUrl(url) {
  const trimmed = url.trim();
  const fileName = trimmed
    .split("?")[0]
    .split("/")
    .pop()
    .replace(/\.gz$/i, "")
    .replace(/\.[^.]+$/, "")
    .trim();
  if (fileName && !fileName.equalsIgnoreCase("xmltv")) return fileName;

  return trimmed.split("://")[1]?.split("/")[0]?.trim().ifBlank("EPG") || "EPG";
}

// String helpers
if (!String.prototype.equalsIgnoreCase) {
  String.prototype.equalsIgnoreCase = function (other) {
    return this.toLowerCase() === String(other).toLowerCase();
  };
}

if (!String.prototype.ifBlank) {
  String.prototype.ifBlank = function (fallback) {
    return this.trim() === "" ? fallback : this;
  };
}

/**
 * Fetches text with abort support
 * @param {string} url
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>}
 */
async function fetchText(url, signal = null) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

/**
 * Refreshes all data
 */
export function refresh() {
  ensureLoaded();
  const state = _uiState;
  if (!hasLiveTvPlaylist(state)) {
    setUiState({
      playlistUrl: "",
      playlists: [],
      channels: [],
      isLoading: false,
      errorMessage: null
    });
    publishNavigationVisibility();
    return;
  }

  const signature = liveTvChannelSourceSignature(state);
  _channelsRequested = true;
  setUiState({ isLoading: true, errorMessage: null });

  if (_refreshAbortController) _refreshAbortController.abort();
  _refreshAbortController = new AbortController();

  refreshChannels(signature, _refreshAbortController.signal);
}

// Export the repository functions
export const LiveTvRepository = {
  subscribe,
  getUiState,
  ensureLoaded,
  ensureChannelsLoaded,
  savePlaylistUrl,
  addPlaylistUrl,
  addLocalPlaylist,
  updatePlaylist,
  removePlaylist,
  setPlaylistEnabled,
  setNavigationEnabled,
  saveStalkerSettings,
  saveXtreamSettings,
  removeStalker,
  removeXtream,
  reloadChannels,
  reloadEpg,
  prepareForPlayback,
  refresh,
  toggleFavoriteChannel,
  markChannelWatched,
  addEpgSource,
  removeEpgSource,
  setEpgSourceEnabled,
  setEpgAutoDetectEnabled
};
