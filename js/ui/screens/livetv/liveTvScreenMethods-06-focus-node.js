import {
  focusWithoutAutoScroll,
  getRootSidebarNodes,
  getRootSidebarSelectedNode,
  getSidebarProfileState
} from "../../components/sidebarNavigation.js";

export function createLiveTvScreenMethods06() {
  return {
    applyFocus() {
      console.log("[LiveTvScreen] applyFocus called, focusZone:", this.focusZone, "hasFocusedContent:", this._hasFocusedContent);
      const focusables = this.getFocusableNodes();
      if (focusables.length === 0) {
        console.log("[LiveTvScreen] applyFocus: no focusables");
        return;
      }

      // Filter to only connected elements
      const connectedFocusables = focusables.filter((node) => node.isConnected && this.container?.contains(node));
      console.log("[LiveTvScreen] applyFocus: focusables:", focusables.length, "connected:", connectedFocusables.length);
      if (connectedFocusables.length === 0) return;

      let targetIndex = Math.min(this.sidebarFocusIndex, connectedFocusables.length - 1);
      const target = connectedFocusables[targetIndex];
      if (target) {
        console.log("[LiveTvScreen] applyFocus: focusing", target.className, target.dataset?.action);
        target.focus();
        focusWithoutAutoScroll(target);
      }
    },

    getFocusableNodes() {
      if (!this.container) return [];
      const focusZone = this.focusZone || "content";
      if (focusZone === "sidebar") {
        return Array.from(this.container.querySelectorAll(".home-sidebar .focusable, .modern-sidebar-panel .focusable"));
      }
      // Content focus: exclude sidebar elements, prioritize channel cards
      const contentRoot = this.container.querySelector(".livetv-content") || this.container;
      const channelCards = Array.from(contentRoot.querySelectorAll(".livetv-channel-card"));
      const recentChannels = Array.from(contentRoot.querySelectorAll(".livetv-recent-channel"));
      const otherFocusables = Array.from(
        contentRoot.querySelectorAll(
          '.livetv-favorite-btn, .livetv-play-btn, .livetv-recent-play, .livetv-filter-chip, .livetv-search-input, [data-action="refresh"]:not(.home-nav-item), [data-action="gotoSettings"]:not(.home-nav-item)'
        )
      );
      // Main channel cards first, then recent, then others
      return [...channelCards, ...recentChannels, ...otherFocusables];
    },

    focusSidebarNode() {
      this.focusZone = "sidebar";
      const sidebarNodes = this.container?.querySelectorAll(".home-sidebar .focusable, .modern-sidebar-panel .focusable");
      if (sidebarNodes?.length) {
        this.sidebarFocusIndex = Math.min(this.sidebarFocusIndex, sidebarNodes.length - 1);
        this.applyFocus();
      }
    },

    focusContentNode() {
      console.log("[LiveTvScreen] focusContentNode called");
      this.focusZone = "content";
      this.applyFocus();
    }
  };
}
