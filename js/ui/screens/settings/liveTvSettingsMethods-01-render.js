import { I18n } from "../../../i18n/index.js";
import { LocalStore } from "../../../core/storage/localStore.js";
import { LiveTvRepository } from "../../../features/livetv/LiveTvRepository.js";

export function createLiveTvSettingsMethods01() {
  return {
    renderLiveTvSettings() {
      const state = LiveTvRepository.getUiState();
      const stalkerSettings = state.stalkerSettings;
      const xtreamSettings = state.xtreamSettings;

      return `
        <div class="settings-section settings-livetv-section">
          <h2 class="settings-section-title">${I18n.t("settings_livetv_title", {}, "Live TV")}</h2>
          <p class="settings-section-subtitle">${I18n.t("settings_livetv_subtitle", {}, "Manage playlists, EPG sources, and provider settings")}</p>

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

          <!-- Xtream Codes Section -->
          <div class="settings-subsection">
            <h3 class="settings-subsection-title">${I18n.t("settings_livetv_xtream_section", {}, "Xtream Codes")}</h3>
            <p class="settings-subsection-subtitle">${I18n.t("settings_livetv_xtream_subtitle", {}, "Xtream Codes IPTV panel integration")}</p>

            ${
              xtreamSettings.serverUrl
                ? `
              <div class="settings-row">
                <div class="settings-row-label">
                  <span class="settings-row-title">${I18n.t("settings_livetv_xtream_server_url", {}, "Server URL")}</span>
                </div>
                <div class="settings-row-value">${xtreamSettings.serverUrl}</div>
              </div>
              <div class="settings-row">
                <div class="settings-row-label">
                  <span class="settings-row-title">${I18n.t("settings_livetv_xtream_username", {}, "Username")}</span>
                </div>
                <div class="settings-row-value">${xtreamSettings.username}</div>
              </div>
              <div class="settings-row settings-toggle-row">
                <div class="settings-row-label">
                  <span class="settings-row-title">${I18n.t("settings_livetv_xtream_enabled", {}, "Enabled")}</span>
                </div>
                <label class="settings-toggle">
                  <input type="checkbox" id="livetv-xtream-enabled" ${xtreamSettings.isEnabled ? "checked" : ""} data-setting="xtreamEnabled">
                  <span class="settings-toggle-slider"></span>
                </label>
              </div>
              <div class="settings-actions">
                <button class="settings-btn settings-btn-danger focusable" data-action="remove-xtream">${I18n.t("settings_livetv_xtream_remove", {}, "Remove Xtream settings")}</button>
                <button class="settings-btn settings-btn-secondary focusable" data-action="edit-xtream">${I18n.t("action_edit", {}, "Edit")}</button>
              </div>
            `
                : `
              <div class="settings-row">
                <div class="settings-row-label">
                  <span class="settings-row-title">${I18n.t("settings_livetv_xtream_server_url", {}, "Server URL")}</span>
                  <span class="settings-row-subtitle">${I18n.t("settings_livetv_xtream_server_url_placeholder", {}, "https://panel.example.com")}</span>
                </div>
                <input type="url" class="settings-input focusable" id="livetv-xtream-server-url" placeholder="${I18n.t("settings_livetv_xtream_server_url_placeholder", {}, "https://panel.example.com")}" required>
              </div>
              <div class="settings-row">
                <div class="settings-row-label">
                  <span class="settings-row-title">${I18n.t("settings_livetv_xtream_username", {}, "Username")}</span>
                </div>
                <input type="text" class="settings-input focusable" id="livetv-xtream-username" placeholder="${I18n.t("settings_livetv_xtream_username", {}, "Username")}" required>
              </div>
              <div class="settings-row">
                <div class="settings-row-label">
                  <span class="settings-row-title">${I18n.t("settings_livetv_xtream_password", {}, "Password")}</span>
                </div>
                <input type="password" class="settings-input focusable" id="livetv-xtream-password" placeholder="${I18n.t("settings_livetv_xtream_password", {}, "Password")}" required>
              </div>
              <div class="settings-row settings-toggle-row">
                <div class="settings-row-label">
                  <span class="settings-row-title">${I18n.t("settings_livetv_xtream_enabled", {}, "Enabled")}</span>
                </div>
                <label class="settings-toggle">
                  <input type="checkbox" id="livetv-xtream-enabled" checked data-setting="xtreamEnabled">
                  <span class="settings-toggle-slider"></span>
                </label>
              </div>
              <div class="settings-actions">
                <button class="settings-btn settings-btn-primary focusable" data-action="save-xtream">${I18n.t("action_save", {}, "Save")}</button>
              </div>
            `
            }
          </div>

          <!-- Stalker Portal Section -->
          <div class="settings-subsection">
            <h3 class="settings-subsection-title">${I18n.t("settings_livetv_stalker_section", {}, "Stalker Portal")}</h3>
            <p class="settings-subsection-subtitle">${I18n.t("settings_livetv_stalker_subtitle", {}, "Stalker Portal / Ministra TV platform integration")}</p>

            ${
              stalkerSettings.portalUrl
                ? `
              <div class="settings-row">
                <div class="settings-row-label">
                  <span class="settings-row-title">${I18n.t("settings_livetv_stalker_portal_url", {}, "Portal URL")}</span>
                </div>
                <div class="settings-row-value">${stalkerSettings.portalUrl}</div>
              </div>
              <div class="settings-row">
                <div class="settings-row-label">
                  <span class="settings-row-title">${I18n.t("settings_livetv_stalker_mac", {}, "MAC Address")}</span>
                </div>
                <div class="settings-row-value">${stalkerSettings.macAddress}</div>
              </div>
              <div class="settings-row">
                <div class="settings-row-label">
                  <span class="settings-row-title">${I18n.t("settings_livetv_stalker_username", {}, "Username")}</span>
                </div>
                <div class="settings-row-value">${stalkerSettings.username || "—"}</div>
              </div>
              <div class="settings-row settings-toggle-row">
                <div class="settings-row-label">
                  <span class="settings-row-title">${I18n.t("settings_livetv_stalker_enabled", {}, "Enabled")}</span>
                </div>
                <label class="settings-toggle">
                  <input type="checkbox" id="livetv-stalker-enabled" ${stalkerSettings.isEnabled ? "checked" : ""} data-setting="stalkerEnabled">
                  <span class="settings-toggle-slider"></span>
                </label>
              </div>
              <div class="settings-actions">
                <button class="settings-btn settings-btn-danger focusable" data-action="remove-stalker">${I18n.t("settings_livetv_stalker_remove", {}, "Remove Stalker settings")}</button>
                <button class="settings-btn settings-btn-secondary focusable" data-action="edit-stalker">${I18n.t("action_edit", {}, "Edit")}</button>
              </div>
            `
                : `
              <div class="settings-row">
                <div class="settings-row-label">
                  <span class="settings-row-title">${I18n.t("settings_livetv_stalker_portal_url", {}, "Portal URL")}</span>
                  <span class="settings-row-subtitle">${I18n.t("settings_livetv_stalker_portal_url_placeholder", {}, "https://portal.example.com/c/")}</span>
                </div>
                <input type="url" class="settings-input focusable" id="livetv-stalker-portal-url" placeholder="${I18n.t("settings_livetv_stalker_portal_url_placeholder", {}, "https://portal.example.com/c/")}" required>
              </div>
              <div class="settings-row">
                <div class="settings-row-label">
                  <span class="settings-row-title">${I18n.t("settings_livetv_stalker_mac", {}, "MAC Address")}</span>
                  <span class="settings-row-subtitle">${I18n.t("settings_livetv_stalker_mac_placeholder", {}, "00:1A:79:XX:XX:XX")}</span>
                </div>
                <input type="text" class="settings-input focusable" id="livetv-stalker-mac" placeholder="${I18n.t("settings_livetv_stalker_mac_placeholder", {}, "00:1A:79:XX:XX:XX")}" required style="text-transform: uppercase;">
              </div>
              <div class="settings-row">
                <div class="settings-row-label">
                  <span class="settings-row-title">${I18n.t("settings_livetv_stalker_username", {}, "Username")}</span>
                </div>
                <input type="text" class="settings-input focusable" id="livetv-stalker-username" placeholder="${I18n.t("settings_livetv_stalker_username", {}, "Username")}">
              </div>
              <div class="settings-row">
                <div class="settings-row-label">
                  <span class="settings-row-title">${I18n.t("settings_livetv_stalker_password", {}, "Password")}</span>
                </div>
                <input type="password" class="settings-input focusable" id="livetv-stalker-password" placeholder="${I18n.t("settings_livetv_stalker_password", {}, "Password")}">
              </div>
              <div class="settings-row settings-toggle-row">
                <div class="settings-row-label">
                  <span class="settings-row-title">${I18n.t("settings_livetv_stalker_enabled", {}, "Enabled")}</span>
                </div>
                <label class="settings-toggle">
                  <input type="checkbox" id="livetv-stalker-enabled" checked data-setting="stalkerEnabled">
                  <span class="settings-toggle-slider"></span>
                </label>
              </div>
              <div class="settings-actions">
                <button class="settings-btn settings-btn-primary focusable" data-action="save-stalker">${I18n.t("action_save", {}, "Save")}</button>
              </div>
            `
            }
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
