import { I18n } from "../../../i18n/index.js";
import { LocalStore } from "../../../core/storage/localStore.js";
import { LiveTvRepository } from "../../../features/livetv/LiveTvRepository.js";
import {
  renderRootSidebar,
  getSidebarProfileState,
  bindRootSidebarEvents,
  focusWithoutAutoScroll
} from "../../components/sidebarNavigation.js";
import { renderLoadingIndicator } from "../../components/loadingIndicator.js";

export function createLiveTvScreenMethods02() {
  return {
    async render() {
      const state = LiveTvRepository.getUiState();
      const profileState = await getSidebarProfileState({ cacheOnly: true });
      const isModern = LocalStore.get("modernSidebar", false);

      this.container.innerHTML = `
        <div class="livetv-screen" style="background: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%); min-height: 100vh;">
          ${renderRootSidebar({ selectedRoute: "livetv", profile: profileState, layout: { modernSidebar: isModern } })}
          <main class="livetv-main" role="main">
            <header class="livetv-header">
              <h1 class="livetv-title">${I18n.t("live_tv_title", {}, "Live TV")}</h1>
              ${
                state.hasPlaylist
                  ? `
                <button class="livetv-refresh-btn focusable" data-action="refresh" aria-label="${I18n.t("action_retry", {}, "Refresh")}">
                  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M17.65 6.35A7.958 7.958 0 0012 4C9.79 4 7.61 4.74 5.9 6.04L3.59 3.72A9.96 9.96 0 0112 2c5.52 0 10 4.48 10 10 0 2.02-.72 3.87-1.88 5.33L17.65 6.35zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>
                </button>
              `
                  : ""
              }
            </header>

            <div class="livetv-content" data-load-state="${state.isLoading ? "loading" : state.errorMessage ? "error" : state.channels.length === 0 ? "empty" : "loaded"}">
              ${this.renderContent(state)}
            </div>
          </main>
        </div>
      `;

      // Bind sidebar events
      bindRootSidebarEvents(this.container, {
        currentRoute: "livetv",
        onSelectedAction: this.onSelectedAction.bind(this),
        onExpandSidebar: this.onExpandSidebar.bind(this)
      });

      // Bind refresh button
      this.container.querySelectorAll('[data-action="refresh"]').forEach((btn) => {
        btn.onclick = () => LiveTvRepository.reloadChannels();
      });

      // Bind channel cards
      this.bindChannelCards();

      // Restore focus
      this.restoreFocus();
    },

    renderContent(state) {
      if (state.isLoading && state.channels.length === 0) {
        return renderLoadingIndicator({ size: "large", label: I18n.t("live_tv_loading", {}, "Loading channels...") });
      }

      if (!state.hasPlaylist) {
        return `
          <div class="livetv-empty-state">
            <svg class="livetv-empty-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
            <h2>${I18n.t("live_tv_no_playlist_title", {}, "No Playlist")}</h2>
            <p>${I18n.t("live_tv_no_playlist_message", {}, "Add an M3U playlist URL or configure Xtream/Stalker in Settings to start watching Live TV.")}</p>
            <button class="livetv-settings-btn focusable" data-action="gotoSettings">${I18n.t("action_settings", {}, "Open Settings")}</button>
          </div>
        `;
      }

      if (state.errorMessage && state.channels.length === 0) {
        return `
          <div class="livetv-empty-state">
            <svg class="livetv-empty-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
            <h2>${I18n.t("live_tv_load_failed", {}, "Failed to Load")}</h2>
            <p>${I18n.t("live_tv_error_message", { message: state.errorMessage }, state.errorMessage)}</p>
            <button class="livetv-retry-btn focusable" data-action="refresh">${I18n.t("action_retry", {}, "Retry")}</button>
          </div>
        `;
      }

      if (state.channels.length === 0) {
        return `
          <div class="livetv-empty-state">
            <svg class="livetv-empty-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
            <h2>${I18n.t("live_tv_empty_title", {}, "No Channels")}</h2>
            <p>${I18n.t("live_tv_empty_message", {}, "No channels found in the current playlist.")}</p>
            <button class="livetv-retry-btn focusable" data-action="refresh">${I18n.t("action_retry", {}, "Refresh")}</button>
          </div>
        `;
      }

      return `
        <div class="livetv-controls-sticky">
          ${this.renderChannelControls(state)}
        </div>
        <div class="livetv-channel-list" role="list" aria-label="${I18n.t("live_tv_channels", {}, "Channels")}">
          ${this.renderChannelList(state)}
        </div>
        ${
          this.visibleChannels.length === 0
            ? `
          <div class="livetv-empty-state">
            <h2>${I18n.t("live_tv_no_matching_channels_title", {}, "No Matching Channels")}</h2>
            <p>${I18n.t("live_tv_no_matching_channels_message", {}, "Try adjusting your search or filter.")}</p>
          </div>
        `
            : ""
        }
      `;
    },

    renderChannelControls(state) {
      const categories = this.buildCategoryOptions(state);
      const allLabel = I18n.t("live_tv_group_all_channels", {}, "All Channels");
      const favoritesLabel = I18n.t("live_tv_filter_favorites", {}, "Favorites");
      const uncategorizedLabel = I18n.t("live_tv_group_uncategorized", {}, "Uncategorized");
      const chooseCategoryLabel = I18n.t("live_tv_filter_choose_category", {}, "Choose Category");

      return `
        <div class="livetv-search-wrapper">
          <input type="search" class="livetv-search-input focusable" placeholder="${I18n.t("live_tv_search_placeholder", {}, "Search channels...")}" value="${this.searchQuery || ""}" aria-label="${I18n.t("live_tv_search_placeholder", {}, "Search channels")}">
          ${this.searchQuery ? `<button class="livetv-search-clear focusable" data-action="clear-search" aria-label="${I18n.t("action_clear", {}, "Clear")}">✕</button>` : ""}
        </div>
        <div class="livetv-filter-bar" role="group" aria-label="${I18n.t("live_tv_filter_label", {}, "Filter channels")}">
          <button class="livetv-filter-chip${this.filterMode === "all" ? " selected" : ""} focusable" data-filter="all" data-action="filter-all">${allLabel}</button>
          <button class="livetv-filter-chip${this.filterMode === "favorites" ? " selected" : ""} focusable" data-filter="favorites" data-action="filter-favorites">${favoritesLabel}</button>
          <div class="livetv-category-dropdown">
            <button class="livetv-filter-chip${this.filterMode === "category" ? " selected" : ""} focusable" data-action="toggle-category-dropdown" aria-expanded="${this.filterMode === "category"}" aria-haspopup="listbox">
              ${this.filterMode === "category" && this.selectedCategoryName ? this.selectedCategoryName : chooseCategoryLabel}
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg>
            </button>
            <div class="livetv-category-dropdown-menu" role="listbox" aria-label="${chooseCategoryLabel}" hidden>
              ${categories
                .map(
                  (cat) => `
                <button class="livetv-category-option focusable" role="option" data-category="${cat.categoryName}" data-action="filter-category" ${cat.categoryName === this.selectedCategoryName ? 'aria-selected="true"' : ""}>
                  ${cat.label}
                </button>
              `
                )
                .join("")}
            </div>
          </div>
          <span class="livetv-channel-count" aria-live="polite">${this.visibleChannels.length}</span>
        </div>
      `;
    },

    buildCategoryOptions(state) {
      const allLabel = I18n.t("live_tv_group_all_channels", {}, "All Channels");
      const favoritesLabel = I18n.t("live_tv_filter_favorites", {}, "Favorites");
      const uncategorizedLabel = I18n.t("live_tv_group_uncategorized", {}, "Uncategorized");

      const categories = state.channels
        .map((ch) => ch.group?.trim())
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i)
        .filter((cat) => ![allLabel, favoritesLabel, uncategorizedLabel].some((l) => l.equalsIgnoreCase(cat)))
        .sort((a, b) => a.localeCompare(b));

      const options = [
        { label: allLabel, mode: "all", categoryName: null },
        { label: favoritesLabel, mode: "favorites", categoryName: null },
        { label: uncategorizedLabel, mode: "category", categoryName: uncategorizedLabel }
      ];

      categories.forEach((cat) => {
        options.push({ label: cat, mode: "category", categoryName: cat });
      });

      return options;
    },

    renderChannelList(state) {
      this.visibleChannels = this.filterChannels(state.channels, state.favoriteChannelIds);
      this.lastWatchedChannel = state.lastWatchedChannelId ? state.channels.find((ch) => ch.id === state.lastWatchedChannelId) : null;

      let html = "";

      if (this.lastWatchedChannel) {
        const categoryName = this.getCategoryName(this.lastWatchedChannel, I18n.t("live_tv_group_uncategorized", {}, "Uncategorized"));
        const programs = state.epgPrograms[this.lastWatchedChannel.id] || [];
        const nowMillis = Date.now();
        const currentProgram = programs.find((p) => p.startMillis <= nowMillis && p.endMillis > nowMillis);
        const nextProgram = programs.find((p) => p.startMillis > nowMillis);

        html += `
          <div class="livetv-recent-channel focusable" data-channel-id="${this.lastWatchedChannel.id}" data-action="play-recent" role="listitem">
            <div class="livetv-recent-logo" style="background-image: url('${this.lastWatchedChannel.logoUrl || ""}')"></div>
            <div class="livetv-recent-info">
              <span class="livetv-recent-label">${I18n.t("live_tv_last_watched_title", {}, "Last Watched")}</span>
              <h3 class="livetv-recent-name">${this.lastWatchedChannel.name}</h3>
              <span class="livetv-recent-category">${categoryName}</span>
              ${
                currentProgram
                  ? `
                <div class="livetv-epg-now-next">
                  <div class="livetv-epg-now">
                    <span class="livetv-epg-now-label">${I18n.t("live_tv_epg_now", {}, "Now")}</span>
                    <span class="livetv-epg-now-title">${currentProgram.title}</span>
                    <div class="livetv-epg-progress" style="--progress: ${(((nowMillis - currentProgram.startMillis) / (currentProgram.endMillis - currentProgram.startMillis)) * 100).toFixed(1)}%"></div>
                  </div>
                  ${
                    nextProgram
                      ? `
                    <div class="livetv-epg-next">
                      <span class="livetv-epg-next-label">${I18n.t("live_tv_epg_next", {}, "Next")}</span>
                      <span class="livetv-epg-next-time">${this.formatEpgTime(nextProgram.startMillis)}</span>
                      <span class="livetv-epg-next-title">${nextProgram.title}</span>
                    </div>
                  `
                      : ""
                  }
                </div>
              `
                  : ""
              }
            </div>
            <button class="livetv-recent-play focusable" data-action="play-recent" aria-label="${I18n.t("live_tv_button_continue", {}, "Continue Watching")}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
            </button>
          </div>
        `;
      }

      html += this.visibleChannels.map((channel) => this.renderChannelCard(channel, state)).join("");
      return html;
    },

    renderChannelCard(channel, state) {
      const isFavorite = state.favoriteChannelIds.has(channel.id);
      const categoryName = this.getCategoryName(channel, I18n.t("live_tv_group_uncategorized", {}, "Uncategorized"));
      const programs = state.epgPrograms[channel.id] || [];
      const nowMillis = Date.now();
      const currentProgram = programs.find((p) => p.startMillis <= nowMillis && p.endMillis > nowMillis);
      const nextProgram = programs.find((p) => p.startMillis > nowMillis);

      return `
        <div class="livetv-channel-card focusable" data-channel-id="${channel.id}" role="listitem" tabindex="0">
          <div class="livetv-channel-logo" style="background-image: url('${channel.logoUrl || ""}')" aria-hidden="true"></div>
          <div class="livetv-channel-info">
            <h3 class="livetv-channel-name">${channel.name}</h3>
            <span class="livetv-channel-category">${categoryName}</span>
            ${
              currentProgram
                ? `
              <div class="livetv-epg-now-next">
                <div class="livetv-epg-now">
                  <span class="livetv-epg-now-label">${I18n.t("live_tv_epg_now", {}, "Now")}</span>
                  <span class="livetv-epg-now-title">${currentProgram.title}</span>
                  <div class="livetv-epg-progress" style="--progress: ${(((nowMillis - currentProgram.startMillis) / (currentProgram.endMillis - currentProgram.startMillis)) * 100).toFixed(1)}%"></div>
                </div>
                ${
                  nextProgram
                    ? `
                  <div class="livetv-epg-next">
                    <span class="livetv-epg-next-label">${I18n.t("live_tv_epg_next", {}, "Next")}</span>
                    <span class="livetv-epg-next-time">${this.formatEpgTime(nextProgram.startMillis)}</span>
                    <span class="livetv-epg-next-title">${nextProgram.title}</span>
                  </div>
                `
                    : ""
                }
              </div>
            `
                : ""
            }
          </div>
          <button class="livetv-favorite-btn${isFavorite ? " favorite" : ""} focusable" data-action="toggle-favorite" data-channel-id="${channel.id}" aria-label="${isFavorite ? I18n.t("live_tv_remove_favorite", {}, "Remove from favorites") : I18n.t("live_tv_add_favorite", {}, "Add to favorites")}" aria-pressed="${isFavorite}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${isFavorite ? "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" : "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"}" fill="${isFavorite ? "currentColor" : "none"}" stroke="${isFavorite ? "none" : "currentColor"}" stroke-width="2"/></svg>
          </button>
          <button class="livetv-play-btn focusable" data-action="play-channel" data-channel-id="${channel.id}" aria-label="${I18n.t("live_tv_button_play", {}, "Play")}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
      `;
    },

    filterChannels(channels, favoriteChannelIds) {
      const query = (this.searchQuery || "").toLowerCase().trim();
      return channels
        .filter((channel) => {
          if (this.filterMode === "favorites" && !favoriteChannelIds.has(channel.id)) return false;
          if (this.filterMode === "category" && this.selectedCategoryName) {
            const catName = this.getCategoryName(channel, I18n.t("live_tv_group_uncategorized", {}, "Uncategorized"));
            if (catName !== this.selectedCategoryName) return false;
          }
          if (query) {
            const searchText = `${channel.name} ${channel.group || ""} ${channel.playlistName || ""}`.toLowerCase();
            if (!searchText.includes(query)) return false;
          }
          return true;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    getCategoryName(channel, uncategorizedLabel) {
      return channel.group?.trim() || uncategorizedLabel;
    },

    formatEpgTime(millis) {
      const date = new Date(millis);
      return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
    },

    bindChannelCards() {
      // Play channel
      this.container.querySelectorAll('[data-action="play-channel"]').forEach((btn) => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          const channelId = btn.dataset.channelId;
          const state = LiveTvRepository.getUiState();
          const channel = state.channels.find((c) => c.id === channelId);
          if (channel) await this.playChannel(channel);
        };
      });

      // Play recent
      this.container.querySelectorAll('[data-action="play-recent"]').forEach((btn) => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          if (this.lastWatchedChannel) await this.playChannel(this.lastWatchedChannel);
        };
      });

      // Toggle favorite
      this.container.querySelectorAll('[data-action="toggle-favorite"]').forEach((btn) => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const channelId = btn.dataset.channelId;
          LiveTvRepository.toggleFavoriteChannel(channelId);
          this.render(); // Re-render to update favorite state
        };
      });

      // Filter buttons
      this.container.querySelectorAll('[data-action="filter-all"]').forEach((btn) => {
        btn.onclick = () => {
          this.filterMode = "all";
          this.selectedCategoryName = null;
          this.render();
        };
      });
      this.container.querySelectorAll('[data-action="filter-favorites"]').forEach((btn) => {
        btn.onclick = () => {
          this.filterMode = "favorites";
          this.selectedCategoryName = null;
          this.render();
        };
      });
      this.container.querySelectorAll('[data-action="toggle-category-dropdown"]').forEach((btn) => {
        btn.onclick = () => {
          const menu = btn.nextElementSibling;
          const expanded = (menu.hidden = !menu.hidden);
          btn.setAttribute("aria-expanded", expanded);
        };
      });
      this.container.querySelectorAll('[data-action="filter-category"]').forEach((btn) => {
        btn.onclick = () => {
          this.filterMode = "category";
          this.selectedCategoryName = btn.dataset.category;
          this.render();
        };
      });

      // Search
      const searchInput = this.container.querySelector(".livetv-search-input");
      if (searchInput) {
        searchInput.oninput = (e) => {
          this.searchQuery = e.target.value;
          this.render();
        };
        searchInput.onkeydown = (e) => {
          if (e.key === "Escape") {
            this.searchQuery = "";
            this.render();
          }
        };
      }
      this.container.querySelectorAll('[data-action="clear-search"]').forEach((btn) => {
        btn.onclick = () => {
          this.searchQuery = "";
          this.render();
        };
      });

      // Settings button
      this.container.querySelectorAll('[data-action="gotoSettings"]').forEach((btn) => {
        btn.onclick = () => Router.navigate("settings");
      });
    },

    async playChannel(channel) {
      const preparedChannel = await LiveTvRepository.prepareForPlayback(channel);
      LiveTvRepository.markChannelWatched(preparedChannel);

      // Navigate to player screen with channel data
      Router.navigate("player", {
        item: {
          id: preparedChannel.id,
          name: preparedChannel.name,
          type: "livetv",
          streamUrl: preparedChannel.streamUrl,
          headers: preparedChannel.headers,
          streamType: preparedChannel.streamType,
          logoUrl: preparedChannel.logoUrl,
          isLive: true
        }
      });
    }
  };
}
