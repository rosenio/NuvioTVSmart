import { ScreenUtils } from "../../navigation/screen.js";
import { LocalStore } from "../../../core/storage/localStore.js";
import { setModernSidebarExpanded, setModernSidebarPillIconOnly, setLegacySidebarExpanded } from "../../components/sidebarNavigation.js";

export function createLiveTvScreenMethods08() {
  return {
    async mount(params, navigationContext) {
      console.log("[LiveTvScreen] mount() start");
      try {
        this.container = document.getElementById("livetv");
        if (!this.container) {
          console.error("[LiveTvScreen] No container found!");
          return;
        }
        ScreenUtils.show(this.container);

        this.focusZone = "content";
        this.sidebarFocusIndex = 0;
        this.searchQuery = "";
        this.filterMode = "all";
        this.selectedCategoryName = null;
        this.visibleChannels = [];
        this.lastWatchedChannel = null;
        this.isMounted = true;
        this.routeStateKey = this.getRouteStateKey();

        console.log("[LiveTvScreen] calling render()");
        this.render();

        // Ensure sidebar is collapsed on mount (after render so elements exist)
        const isModern = LocalStore.get("modernSidebar", false);
        if (isModern) {
          setModernSidebarExpanded(this.container, false);
          setModernSidebarPillIconOnly(this.container, false);
        } else {
          setLegacySidebarExpanded(this.container, false);
        }

        console.log("[LiveTvScreen] calling loadData()");
        await this.loadData();
        console.log("[LiveTvScreen] loadData() done");

        // Focus first item
        this.applyFocus();
        console.log("[LiveTvScreen] mount() complete");
      } catch (e) {
        console.error("[LiveTvScreen] mount error:", e);
      }
    },

    async unmount() {
      console.log("[LiveTvScreen] unmount()");
      this.isMounted = false;
      this.cleanup();
    }
  };
}
