export function createLiveTvScreenMethods05() {
  return {
    cleanup() {
      this.closeSidebarToContent();
      this.isMounted = false;
      if (this.unsubscribeRepo) {
        this.unsubscribeRepo();
        this.unsubscribeRepo = null;
      }
      this.container = null;
      this.focusZone = null;
      this.sidebarFocusIndex = 0;
      this.searchQuery = "";
      this.filterMode = "all";
      this.selectedCategoryName = null;
      this.visibleChannels = [];
      this.lastWatchedChannel = null;
    }
  };
}
