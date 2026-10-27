/**
 * LiveTV Models - Ported from NuvioMobile-Enhanced Kotlin implementation
 * Defines data structures for Live TV channels, playlists, EPG, and settings
 */

export const LiveTvPlaylistType = {
  Url: "url",
  LocalFile: "local_file"
};

/**
 * Live TV Channel model
 * @typedef {Object} LiveTvChannel
 * @property {string} id - Unique channel identifier
 * @property {string} name - Channel display name
 * @property {string} streamUrl - Stream URL (HLS/DASH)
 * @property {string} [logoUrl] - Channel logo image URL
 * @property {string} [group] - Channel group/category
 * @property {string} [playlistId] - Parent playlist ID
 * @property {string} [playlistName] - Parent playlist name
 * @property {Object<string,string>} [headers] - HTTP headers for stream requests
 * @property {string} [streamType] - Stream container type (ts, m3u8, mpd)
 * @property {string} [stalkerCommand] - Stalker portal command for dynamic streams
 * @property {string} [epgId] - EPG channel identifier for matching
 */

/**
 * Creates a LiveTvChannel object
 * @param {Object} params
 * @returns {LiveTvChannel}
 */
export function createLiveTvChannel({
  id,
  name,
  streamUrl,
  logoUrl = null,
  group = null,
  playlistId = null,
  playlistName = null,
  headers = {},
  streamType = null,
  stalkerCommand = null,
  epgId = null
}) {
  return {
    id,
    name,
    streamUrl,
    logoUrl,
    group,
    playlistId,
    playlistName,
    headers,
    streamType,
    stalkerCommand,
    epgId
  };
}

/**
 * Live TV EPG Program model
 * @typedef {Object} LiveTvEpgProgram
 * @property {string} title - Program title
 * @property {number} startMillis - Start time in milliseconds since epoch
 * @property {number} endMillis - End time in milliseconds since epoch
 * @property {string} [description] - Program description
 * @property {string} [category] - Program category/genre
 */

/**
 * Creates a LiveTvEpgProgram object
 * @param {Object} params
 * @returns {LiveTvEpgProgram}
 */
export function createLiveTvEpgProgram({
  title,
  startMillis,
  endMillis,
  description = null,
  category = null
}) {
  return {
    title,
    startMillis,
    endMillis,
    description,
    category
  };
}

/**
 * Checks if program is airing at given time
 * @param {LiveTvEpgProgram} program
 * @param {number} timeMillis
 * @returns {boolean}
 */
export function isEpgProgramAiringAt(program, timeMillis) {
  return timeMillis >= program.startMillis && timeMillis < program.endMillis;
}

/**
 * Calculates program progress at given time (0-1)
 * @param {LiveTvEpgProgram} program
 * @param {number} timeMillis
 * @returns {number}
 */
export function getEpgProgramProgressAt(program, timeMillis) {
  const duration = program.endMillis - program.startMillis;
  if (duration <= 0) return 0;
  return Math.max(0, Math.min(1, (timeMillis - program.startMillis) / duration));
}

/**
 * Finds current program from list at given time
 * @param {LiveTvEpgProgram[]} programs
 * @param {number} nowMillis
 * @returns {LiveTvEpgProgram|null}
 */
export function findCurrentEpgProgram(programs, nowMillis) {
  return programs.find((p) => isEpgProgramAiringAt(p, nowMillis)) || null;
}

/**
 * Finds next program from list after given time
 * @param {LiveTvEpgProgram[]} programs
 * @param {number} nowMillis
 * @returns {LiveTvEpgProgram|null}
 */
export function findNextEpgProgram(programs, nowMillis) {
  const upcoming = programs
    .filter((p) => p.endMillis > nowMillis)
    .sort((a, b) => a.startMillis - b.startMillis);
  return upcoming[0] || null;
}

/**
 * Filters upcoming programs from list after given time
 * @param {LiveTvEpgProgram[]} programs
 * @param {number} nowMillis
 * @returns {LiveTvEpgProgram[]}
 */
export function filterUpcomingEpgPrograms(programs, nowMillis) {
  return programs.filter((p) => p.endMillis > nowMillis);
}

/**
 * Live TV EPG Source model
 * @typedef {Object} LiveTvEpgSource
 * @property {string} id - Unique source identifier
 * @property {string} name - Display name
 * @property {string} url - EPG XMLTV URL
 * @property {boolean} isEnabled - Whether source is active
 */

/**
 * Creates a LiveTvEpgSource object
 * @param {Object} params
 * @returns {LiveTvEpgSource}
 */
export function createLiveTvEpgSource({ id, name, url, isEnabled = true }) {
  return { id, name, url, isEnabled };
}

/**
 * Live TV Stalker Portal Settings
 * @typedef {Object} LiveTvStalkerSettings
 * @property {string} portalUrl - Portal base URL
 * @property {string} macAddress - Device MAC address
 * @property {string} username - Username
 * @property {string} password - Password
 * @property {boolean} isEnabled - Whether enabled
 */

/**
 * Creates default Stalker settings
 * @returns {LiveTvStalkerSettings}
 */
export function createDefaultStalkerSettings() {
  return {
    portalUrl: "",
    macAddress: "",
    username: "",
    password: "",
    isEnabled: true
  };
}

/**
 * Checks if Stalker settings are configured
 * @param {LiveTvStalkerSettings} settings
 * @returns {boolean}
 */
export function isStalkerConfigured(settings) {
  return settings.portalUrl.trim() !== "" && settings.macAddress.trim() !== "";
}

/**
 * Live TV Xtream Codes Settings
 * @typedef {Object} LiveTvXtreamSettings
 * @property {string} serverUrl - Server URL (without /player_api.php)
 * @property {string} username - Username
 * @property {string} password - Password
 * @property {boolean} isEnabled - Whether enabled
 */

/**
 * Creates default Xtream settings
 * @returns {LiveTvXtreamSettings}
 */
export function createDefaultXtreamSettings() {
  return {
    serverUrl: "",
    username: "",
    password: "",
    isEnabled: true
  };
}

/**
 * Checks if Xtream settings are configured
 * @param {LiveTvXtreamSettings} settings
 * @returns {boolean}
 */
export function isXtreamConfigured(settings) {
  return (
    settings.serverUrl.trim() !== "" &&
    settings.username.trim() !== "" &&
    settings.password.trim() !== ""
  );
}

/**
 * Live TV Playlist model
 * @typedef {Object} LiveTvPlaylist
 * @property {string} id - Unique playlist identifier
 * @property {string} name - Display name
 * @property {string} type - 'url' or 'local_file'
 * @property {string} source - URL or file content
 * @property {boolean} isEnabled - Whether playlist is active
 */

/**
 * Creates a LiveTvPlaylist object
 * @param {Object} params
 * @returns {LiveTvPlaylist}
 */
export function createLiveTvPlaylist({ id, name, type, source, isEnabled = true }) {
  return { id, name, type, source, isEnabled };
}

/**
 * Creates a URL-based playlist
 * @param {string} url - Playlist URL
 * @param {string} [name] - Optional display name
 * @returns {LiveTvPlaylist}
 */
export function createUrlPlaylist(url, name = null) {
  return createLiveTvPlaylist({
    id: stablePlaylistId(url, Date.now()),
    name: name || url,
    type: "url",
    source: url,
    isEnabled: true
  });
}

/**
 * Live TV UI State - Central state for LiveTV feature
 * @typedef {Object} LiveTvUiState
 * @property {string} playlistUrl - Legacy single playlist URL
 * @property {LiveTvPlaylist[]} playlists - Playlist list
 * @property {LiveTvStalkerSettings} stalkerSettings - Stalker portal config
 * @property {LiveTvXtreamSettings} xtreamSettings - Xtream Codes config
 * @property {LiveTvChannel[]} channels - Loaded channels
 * @property {Set<string>} favoriteChannelIds - Favorite channel IDs
 * @property {string} [lastWatchedChannelId] - Last watched channel
 * @property {boolean} isNavigationEnabled - Show in sidebar
 * @property {boolean} isLoading - Channels loading
 * @property {string} [errorMessage] - Channel load error
 * @property {LiveTvEpgSource[]} epgSources - Configured EPG sources
 * @property {boolean} isEpgAutoDetectEnabled - Auto-detect EPG from playlists
 * @property {Object<string, LiveTvEpgProgram[]>} epgPrograms - EPG programs by channel ID
 * @property {boolean} isEpgLoading - EPG loading
 * @property {string} [epgErrorMessage] - EPG load error
 */

/**
 * Creates default LiveTV UI State
 * @returns {LiveTvUiState}
 */
export function createDefaultLiveTvUiState() {
  return {
    playlistUrl: "",
    playlists: [],
    stalkerSettings: createDefaultStalkerSettings(),
    xtreamSettings: createDefaultXtreamSettings(),
    channels: [],
    favoriteChannelIds: new Set(),
    lastWatchedChannelId: null,
    isNavigationEnabled: true,
    isLoading: false,
    errorMessage: null,
    epgSources: [],
    isEpgAutoDetectEnabled: true,
    epgPrograms: {},
    isEpgLoading: false,
    epgErrorMessage: null
  };
}

/**
 * Checks if any playlist/source is configured
 * @param {LiveTvUiState} state
 * @returns {boolean}
 */
export function hasLiveTvPlaylist(state) {
  return (
    state.playlists.some((p) => p.isEnabled) ||
    state.playlistUrl.trim() !== "" ||
    isStalkerConfigured(state.stalkerSettings) ||
    isXtreamConfigured(state.xtreamSettings)
  );
}

/**
 * Checks if Live TV should show in navigation
 * @param {LiveTvUiState} state
 * @returns {boolean}
 */
export function shouldShowInNavigation(state) {
  return hasLiveTvPlaylist(state) && state.isNavigationEnabled;
}

/**
 * Formats EPG time to HH:MM
 * @param {number} epochMillis
 * @returns {string}
 */
export function formatEpgTime(epochMillis) {
  const date = new Date(epochMillis);
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

/**
 * Formats EPG time range (HH:MM - HH:MM)
 * @param {LiveTvEpgProgram} program
 * @returns {string}
 */
export function formatEpgTimeRange(program) {
  return `${formatEpgTime(program.startMillis)} - ${formatEpgTime(program.endMillis)}`;
}

/**
 * Generates stable ID for channel from stream URL
 * @param {string} streamUrl
 * @param {number} index
 * @returns {string}
 */
export function stableChannelId(streamUrl, index) {
  let hash = 0;
  for (let i = 0; i < streamUrl.length; i++) {
    hash = (hash << 5) - hash + streamUrl.charCodeAt(i);
    hash |= 0;
  }
  return `live:${Math.abs(hash).toString(16)}:${index}`;
}

/**
 * Generates stable ID for playlist from source
 * @param {string} source
 * @param {number} index
 * @returns {string}
 */
export function stablePlaylistId(source, index) {
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = (hash << 5) - hash + source.charCodeAt(i);
    hash |= 0;
  }
  return `playlist:${Math.abs(hash).toString(16)}:${index}`;
}

/**
 * Generates stable ID for EPG source from URL
 * @param {string} url
 * @param {number} index
 * @returns {string}
 */
export function stableEpgSourceId(url, index) {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash << 5) - hash + url.charCodeAt(i);
    hash |= 0;
  }
  return `epg:${Math.abs(hash).toString(16)}:${index}`;
}

/**
 * Normalizes EPG channel name for matching
 * @param {string} name
 * @returns {string}
 */
export function normalizeEpgChannelName(name) {
  // Remove content in brackets
  let withoutBrackets = "";
  let depth = 0;
  for (const char of name.toLowerCase()) {
    if ("([{".includes(char)) depth++;
    else if (")]}".includes(char)) depth = Math.max(0, depth - 1);
    else if (depth === 0) withoutBrackets += char;
  }

  let result = withoutBrackets.trim();

  // Remove prefix before : or | if short
  const prefixSep = result.search(/[:|]/);
  if (prefixSep >= 1 && prefixSep <= 5 && prefixSep < result.length - 1) {
    result = result.substring(prefixSep + 1);
  }

  // Tokenize alphanumeric
  const tokens = [];
  let token = "";
  for (const char of result) {
    if (/[a-z0-9]/i.test(char)) {
      token += char;
    } else if (token) {
      tokens.push(token);
      token = "";
    }
  }
  if (token) tokens.push(token);

  // Filter quality tokens
  const qualityTokens = new Set([
    "hd",
    "fhd",
    "uhd",
    "sd",
    "hq",
    "lq",
    "4k",
    "8k",
    "hevc",
    "h264",
    "h265",
    "2160p",
    "1080p",
    "1080i",
    "720p",
    "576p",
    "480p",
    "50fps",
    "60fps",
    "backup",
    "raw"
  ]);
  const filtered = tokens.filter((t) => !qualityTokens.has(t));
  return (filtered.length > 0 ? filtered : tokens).join("");
}

/**
 * Creates EPG key from channel identifier
 * @param {string} value
 * @returns {string}
 */
export function liveTvEpgKey(value) {
  return value.trim().toLowerCase();
}

/**
 * Generates EPG ID name candidates for matching
 * @param {string} id
 * @returns {string[]}
 */
export function epgIdNameCandidates(id) {
  const trimmed = id.trim();
  const suffix = trimmed.substringAfterLast(".");
  const withoutCountry =
    suffix.length >= 2 && suffix.length <= 3 && /^[a-z]+$/i.test(suffix)
      ? trimmed.substringBeforeLast(".")
      : trimmed;

  return [normalizeEpgChannelName(withoutCountry), normalizeEpgChannelName(trimmed)]
    .filter((s) => s !== "")
    .filter((v, i, a) => a.indexOf(v) === i);
}

// String prototype helpers
if (!String.prototype.substringAfterLast) {
  String.prototype.substringAfterLast = function (delimiter, missingDelimiterValue = this) {
    const idx = this.lastIndexOf(delimiter);
    return idx === -1 ? missingDelimiterValue : this.substring(idx + delimiter.length);
  };
}

if (!String.prototype.substringBeforeLast) {
  String.prototype.substringBeforeLast = function (delimiter, missingDelimiterValue = this) {
    const idx = this.lastIndexOf(delimiter);
    return idx === -1 ? missingDelimiterValue : this.substring(0, idx);
  };
}

if (!String.prototype.substringAfter) {
  String.prototype.substringAfter = function (delimiter, missingDelimiterValue = this) {
    const idx = this.indexOf(delimiter);
    return idx === -1 ? missingDelimiterValue : this.substring(idx + delimiter.length);
  };
}

if (!String.prototype.substringBefore) {
  String.prototype.substringBefore = function (delimiter, missingDelimiterValue = this) {
    const idx = this.indexOf(delimiter);
    return idx === -1 ? missingDelimiterValue : this.substring(0, idx);
  };
}

if (!String.prototype.removeSuffix) {
  String.prototype.removeSuffix = function (suffix) {
    return this.endsWith(suffix) ? this.slice(0, -suffix.length) : this;
  };
}

if (!String.prototype.removePrefix) {
  String.prototype.removePrefix = function (prefix) {
    return this.startsWith(prefix) ? this.slice(prefix.length) : this;
  };
}
