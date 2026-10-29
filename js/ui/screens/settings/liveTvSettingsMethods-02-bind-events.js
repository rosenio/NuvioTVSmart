import { I18n } from "../../../i18n/index.js";
import { LiveTvRepository } from "../../../features/livetv/LiveTvRepository.js";

export function createLiveTvSettingsMethods02() {
  return {
    bindLiveTvSettingsEvents() {
      const container = this.container;

      // Navigation toggle
      container.querySelectorAll('[data-setting="navigationEnabled"]').forEach((input) => {
        input.onchange = (e) => {
          LiveTvRepository.setNavigationEnabled(e.target.checked);
        };
      });

      // EPG auto-detect toggle
      container.querySelectorAll('[data-setting="epgAutoDetect"]').forEach((input) => {
        input.onchange = (e) => {
          LiveTvRepository.setEpgAutoDetectEnabled(e.target.checked);
        };
      });

      // Add playlist URL
      container.querySelectorAll('[data-action="add-playlist-url"]').forEach((btn) => {
        btn.onclick = () => this.showAddPlaylistUrlDialog();
      });

      // Add playlist file
      container.querySelectorAll('[data-action="add-playlist-file"]').forEach((btn) => {
        btn.onclick = () => this.showAddPlaylistFileDialog();
      });

      // Toggle playlist
      container.querySelectorAll('[data-action="toggle-playlist"]').forEach((input) => {
        input.onchange = (e) => {
          const playlistId = e.target.dataset.playlistId;
          LiveTvRepository.setPlaylistEnabled(playlistId, e.target.checked);
        };
      });

      // Edit playlist
      container.querySelectorAll('[data-action="edit-playlist"]').forEach((btn) => {
        btn.onclick = () => {
          const playlistId = btn.dataset.playlistId;
          const state = LiveTvRepository.getUiState();
          const playlist = state.playlists.find((p) => p.id === playlistId);
          if (playlist) this.showEditPlaylistDialog(playlist);
        };
      });

      // Remove playlist
      container.querySelectorAll('[data-action="remove-playlist"]').forEach((btn) => {
        btn.onclick = () => {
          const playlistId = btn.dataset.playlistId;
          this.showConfirmDialog(
            I18n.t("settings_livetv_remove_playlist", {}, "Remove playlist"),
            I18n.t("settings_livetv_remove_playlist_confirm", {}, "Are you sure you want to remove this playlist?"),
            () => LiveTvRepository.removePlaylist(playlistId)
          );
        };
      });

      // Add EPG source
      container.querySelectorAll('[data-action="add-epg-source"]').forEach((btn) => {
        btn.onclick = () => this.showAddEpgSourceDialog();
      });

      // Toggle EPG source
      container.querySelectorAll('[data-action="toggle-epg-source"]').forEach((input) => {
        input.onchange = (e) => {
          const sourceId = e.target.dataset.epgSourceId;
          LiveTvRepository.setEpgSourceEnabled(sourceId, e.target.checked);
        };
      });

      // Remove EPG source
      container.querySelectorAll('[data-action="remove-epg-source"]').forEach((btn) => {
        btn.onclick = () => {
          const sourceId = btn.dataset.epgSourceId;
          this.showConfirmDialog(
            I18n.t("settings_livetv_remove_epg_source", {}, "Remove EPG source"),
            I18n.t("settings_livetv_remove_epg_source_confirm", {}, "Are you sure you want to remove this EPG source?"),
            () => LiveTvRepository.removeEpgSource(sourceId)
          );
        };
      });
    },

    showAddPlaylistUrlDialog() {
      // Show dialog to add playlist URL
      this.showTextInputDialog(
        I18n.t("settings_livetv_add_playlist_url", {}, "Add playlist URL"),
        I18n.t("settings_livetv_playlist_name", {}, "Playlist name (optional)"),
        "",
        I18n.t("settings_livetv_playlist_url_placeholder", {}, "https://example.com/playlist.m3u"),
        (name, url) => {
          if (url.trim()) {
            LiveTvRepository.addPlaylistUrl(url.trim(), name.trim() || null);
          }
        }
      );
    },

    showAddPlaylistFileDialog() {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".m3u,.m3u8,.txt";
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        const name = file.name.replace(/\.[^.]+$/, "");
        LiveTvRepository.addLocalPlaylist(text, file.name, name);
      };
      input.click();
    },

    showEditPlaylistDialog(playlist) {
      this.showTextInputDialog(
        I18n.t("action_edit", {}, "Edit playlist"),
        I18n.t("settings_livetv_playlist_name", {}, "Playlist name"),
        playlist.name,
        playlist.source,
        (name, source) => {
          if (source.trim()) {
            LiveTvRepository.updatePlaylist(playlist.id, name, source);
          }
        }
      );
    },

    showAddEpgSourceDialog() {
      this.showTextInputDialog(
        I18n.t("settings_livetv_add_epg_source", {}, "Add EPG source"),
        I18n.t("settings_livetv_epg_source_name", {}, "Source name (optional)"),
        "",
        I18n.t("settings_livetv_epg_source_url_placeholder", {}, "https://example.com/epg.xml.gz"),
        (name, url) => {
          if (url.trim()) {
            LiveTvRepository.addEpgSource(url.trim(), name.trim() || null);
          }
        }
      );
    },

    saveXtreamSettings() {
      const container = this.container;
      const serverUrl = container.querySelector("#livetv-xtream-server-url")?.value?.trim();
      const username = container.querySelector("#livetv-xtream-username")?.value?.trim();
      const password = container.querySelector("#livetv-xtream-password")?.value?.trim();
      const enabled = container.querySelector("#livetv-xtream-enabled")?.checked;

      if (!serverUrl || !username || !password) {
        this.showToast(I18n.t("settings_livetv_fill_all_fields", {}, "Please fill in all fields"));
        return;
      }

      LiveTvRepository.saveXtreamSettings({ serverUrl, username, password, isEnabled: enabled });
      this.showToast(I18n.t("action_saved", {}, "Saved"));
    },

    showEditXtreamDialog(settings) {
      this.showTextInputDialog(
        I18n.t("action_edit", {}, "Edit Xtream settings"),
        I18n.t("settings_livetv_xtream_server_url", {}, "Server URL"),
        settings.serverUrl,
        settings.username,
        (serverUrl, username) => {
          const password = prompt(I18n.t("settings_livetv_xtream_password", {}, "Password"), settings.password);
          if (password !== null) {
            LiveTvRepository.saveXtreamSettings({ serverUrl, username, password, isEnabled: settings.isEnabled });
          }
        }
      );
    },

    saveStalkerSettings() {
      const container = this.container;
      const portalUrl = container.querySelector("#livetv-stalker-portal-url")?.value?.trim();
      const macAddress = container.querySelector("#livetv-stalker-mac")?.value?.trim().toUpperCase();
      const username = container.querySelector("#livetv-stalker-username")?.value?.trim();
      const password = container.querySelector("#livetv-stalker-password")?.value?.trim();
      const enabled = container.querySelector("#livetv-stalker-enabled")?.checked;

      if (!portalUrl || !macAddress) {
        this.showToast(I18n.t("settings_livetv_fill_all_fields", {}, "Please fill in all required fields"));
        return;
      }

      // Validate MAC address format
      if (!/^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/i.test(macAddress)) {
        this.showToast(I18n.t("settings_livetv_invalid_mac", {}, "Invalid MAC address format (use XX:XX:XX:XX:XX:XX)"));
        return;
      }

      LiveTvRepository.saveStalkerSettings({ portalUrl, macAddress, username, password, isEnabled: enabled });
      this.showToast(I18n.t("action_saved", {}, "Saved"));
    },

    showEditStalkerDialog(settings) {
      this.showTextInputDialog(
        I18n.t("action_edit", {}, "Edit Stalker settings"),
        I18n.t("settings_livetv_stalker_portal_url", {}, "Portal URL"),
        settings.portalUrl,
        settings.macAddress,
        (portalUrl, macAddress) => {
          const username = prompt(I18n.t("settings_livetv_stalker_username", {}, "Username"), settings.username);
          if (username !== null) {
            const password = prompt(I18n.t("settings_livetv_stalker_password", {}, "Password"), settings.password);
            if (password !== null) {
              LiveTvRepository.saveStalkerSettings({ portalUrl, macAddress, username, password, isEnabled: settings.isEnabled });
            }
          }
        }
      );
    }
  };
}
