import { I18n } from "../../../i18n/index.js";
import { LocalStore } from "../../../core/storage/localStore.js";
import { LiveTvRepository } from "../../../features/livetv/LiveTvRepository.js";

export function createLiveTvSettingsMethods01() {
  return {
    renderLiveTvSettings() {
      const state = LiveTvRepository.getUiState();

      return `
        <div class="settings-section settings-livetv-section">
          <h2 class="settings-section-title">${I18n.t("settings_livetv_title", {}, "Live TV")}</h2>
          <p class="settings-section-subtitle">${I18n.t("settings_livetv_subtitle", {}, "Manage playlists and EPG sources")}</p>

          <!-- Navigation Toggle -->
          <div class="settings-row settings-toggle-row">
            <div class="settings-row-label">
              <span class="settings-row-title">${I18n.t("settings_livetv_navigation", {}, "Show in navigation")}</span>
              <span class="settings-row-subtitle">${I18n.t("settings_livetv_navigation_sub", {}, "Show Live TV in the sidebar when playlists are configured")}</span>
            </div>
            <label class="settings-toggle">
              <input type="checkbox" id="livetv-navigation-enabled" ${state.isNavigationEnabled ? "checked" : ""} data-setting="navigationEnabled">
              <span class="settings-toggle-slider"></span>
            </label>
          </div>

          <!-- Playlists Section -->
          <div class="settings-subsection">
            <h3 class="settings-subsection-title">${I18n.t("settings_livetv_playlists_section", {}, "Playlists")}</h3>
            <p class="settings-subsection-subtitle">${I18n.t("settings_livetv_playlists_subtitle", {}, "M3U playlist URLs and local files")}</p>

            <div id="livetv-playlists-list" class="settings-list">
              ${this.renderPlaylistsList(state.playlists)}
            </div>

            <div class="settings-actions">
              <button class="settings-btn settings-btn-primary focusable" data-action="add-playlist-url">${I18n.t("settings_livetv_add_playlist_url", {}, "Add playlist URL")}</button>
              <button class="settings-btn settings-btn-secondary focusable" data-action="add-playlist-file">${I18n.t("settings_livetv_add_playlist_file", {}, "Add playlist file")}</button>
            </div>
          </div>

          <!-- EPG Sources Section -->
          <div class="settings-subsection">
            <h3 class="settings-subsection-title">${I18n.t("settings_livetv_epg_sources_section", {}, "EPG Sources")}</h3>
            <p class="settings-subsection-subtitle">${I18n.t("settings_livetv_epg_sources_subtitle", {}, "XMLTV guide URLs for program information")}</p>

            <div class="settings-row settings-toggle-row">
              <div class="settings-row-label">
                <span class="settings-row-title">${I18n.t("settings_livetv_epg_auto_detect", {}, "Auto-detect EPG from playlists")}</span>
                <span class="settings-row-subtitle">${I18n.t("settings_livetv_epg_auto_detect_sub", {}, "Automatically extract EPG URLs from M3U playlists")}</span>
              </div>
              <label class="settings-toggle">
                <input type="checkbox" id="livetv-epg-auto-detect" ${state.isEpgAutoDetectEnabled ? "checked" : ""} data-setting="epgAutoDetect">
                <span class="settings-toggle-slider"></span>
              </label>
            </div>

            <div id="livetv-epg-sources-list" class="settings-list">
              ${this.renderEpgSourcesList(state.epgSources)}
            </div>

            <div class="settings-actions">
              <button class="settings-btn settings-btn-primary focusable" data-action="add-epg-source">${I18n.t("settings_livetv_add_epg_source", {}, "Add EPG source")}</button>
            </div>
          </div>
        </div>
      `;
    },

    renderPlaylistsList(playlists) {
      if (playlists.length === 0) {
        return `<p class="settings-empty">${I18n.t("settings_livetv_no_playlists", {}, "No playlists configured")}</p>`;
      }
      return playlists
        .map(
          (playlist) => `
        <div class="settings-list-item" data-playlist-id="${playlist.id}">
          <div class="settings-list-item-info">
            <span class="settings-list-item-title">${playlist.name}</span>
            <span class="settings-list-item-subtitle">${playlist.type === "url" ? playlist.source : I18n.t("settings_livetv_local_file", {}, "Local file")}</span>
          </div>
          <div class="settings-list-item-actions">
            <label class="settings-toggle settings-toggle-small">
              <input type="checkbox" ${playlist.isEnabled ? "checked" : ""} data-action="toggle-playlist" data-playlist-id="${playlist.id}">
              <span class="settings-toggle-slider"></span>
            </label>
            <button class="settings-btn-icon focusable" data-action="edit-playlist" data-playlist-id="${playlist.id}" aria-label="${I18n.t("action_edit", {}, "Edit")}">✎</button>
            <button class="settings-btn-icon settings-btn-icon-danger focusable" data-action="remove-playlist" data-playlist-id="${playlist.id}" aria-label="${I18n.t("settings_livetv_remove_playlist", {}, "Remove playlist")}">✕</button>
          </div>
        </div>
      `
        )
        .join("");
    },

    renderEpgSourcesList(sources) {
      if (sources.length === 0) {
        return `<p class="settings-empty">${I18n.t("settings_livetv_no_epg_sources", {}, "No EPG sources configured")}</p>`;
      }
      return sources
        .map(
          (source) => `
        <div class="settings-list-item" data-epg-source-id="${source.id}">
          <div class="settings-list-item-info">
            <span class="settings-list-item-title">${source.name}</span>
            <span class="settings-list-item-subtitle">${source.url}</span>
          </div>
          <div class="settings-list-item-actions">
            <label class="settings-toggle settings-toggle-small">
              <input type="checkbox" ${source.isEnabled ? "checked" : ""} data-action="toggle-epg-source" data-epg-source-id="${source.id}">
              <span class="settings-toggle-slider"></span>
            </label>
            <button class="settings-btn-icon settings-btn-icon-danger focusable" data-action="remove-epg-source" data-epg-source-id="${source.id}" aria-label="${I18n.t("settings_livetv_remove_epg_source", {}, "Remove EPG source")}">✕</button>
          </div>
        </div>
      `
        )
        .join("");
    }
  };
}
