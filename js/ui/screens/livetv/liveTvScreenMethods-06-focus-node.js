import {
  focusWithoutAutoScroll,
  getRootSidebarNodes,
  getRootSidebarSelectedNode,
  getSidebarProfileState
} from "../../components/sidebarNavigation.js";

export function createLiveTvScreenMethods06() {
  return {
    applyFocus() {
      const focusables = this.getFocusableNodes();
      if (focusables.length === 0) return;

      let targetIndex = Math.min(this.sidebarFocusIndex, focusables.length - 1);
      const target = focusables[targetIndex];
      if (target) {
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
      return Array.from(
        this.container.querySelectorAll(
          '.livetv-channel-card, .livetv-recent-channel, .livetv-filter-chip, .livetv-search-input, .livetv-favorite-btn, .livetv-play-btn, .livetv-recent-play, [data-action="refresh"], [data-action="gotoSettings"]'
        )
      );
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
      this.focusZone = "content";
      this.applyFocus();
    }
  };
}
