import { ScreenUtils } from "../../navigation/screen.js";
import { LocalStore } from "../../../core/storage/localStore.js";
import { setModernSidebarExpanded, setModernSidebarPillIconOnly, setLegacySidebarExpanded } from "../../components/sidebarNavigation.js";
import { LiveTvRepository } from "../../../features/livetv/LiveTvRepository.js";

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
        this.filterMode = "favorites"; // Start with favorites view
        this.selectedCategoryName = null;
        this.categoryDropdownOpen = false;
        this._focusChannelListAfterRender = false;
        console.log("[DEBUG mount] filterMode set to:", this.filterMode);
        this.selectedCategoryName = null;
        this.visibleChannels = [];
        this.lastWatchedChannel = null;
        this.isMounted = true;
        this.routeStateKey = this.getRouteStateKey();

        // Chunked/incremental rendering for large channel lists
        this.CHUNK_SIZE = 100;
        this.renderedChunkCount = 0;
        this._isRenderingChunk = false;

        console.log("[LiveTvScreen] calling loadData()");
        await this.loadData();
        console.log("[LiveTvScreen] loadData() done");

        // Render AFTER loadData initializes subscription (channels may still be loading)
        this.render();

        // Restore sidebar from playback hidden state to normal collapsed state
        const isModern = LocalStore.get("modernSidebar", false);
        if (isModern) {
          this.restoreSidebarFromPlayback();
        } else {
          setLegacySidebarExpanded(this.container, false);
        }

        console.log("[LiveTvScreen] mount() complete");
      } catch (e) {
        console.error("[LiveTvScreen] mount error:", e);
      }
    },

    async unmount() {
      console.log("[LiveTvScreen] unmount()");
      this.isMounted = false;
      if (this.unsubscribeRepo) {
        this.unsubscribeRepo();
        this.unsubscribeRepo = null;
      }
      this.cleanup();
    }
  };
}
