import { LiveTvRepository } from "../../../features/livetv/LiveTvRepository.js";

export function createLiveTvScreenMethods03() {
  return {
    async loadData() {
      LiveTvRepository.ensureChannelsLoaded();

      // Subscribe to repository updates
      this.unsubscribeRepo = LiveTvRepository.subscribe(() => {
        if (this.isMounted && this.container && this.container.isConnected) {
          this.render();
        }
      });

      // Initial render
      if (this.isMounted && this.container && this.container.isConnected) {
        this.render();
      }
    }
  };
}
