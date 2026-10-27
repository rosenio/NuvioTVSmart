import { LiveTvRepository } from "../../../features/livetv/LiveTvRepository.js";

export function createLiveTvScreenMethods03() {
  return {
    async loadData() {
      // Reset focus tracking
      this._hasFocusedContent = false;

      // Load channels FIRST - this populates state before subscription fires
      await LiveTvRepository.ensureChannelsLoaded();

      // NOW subscribe - state already has playlists loaded
      this.unsubscribeRepo = LiveTvRepository.subscribe(() => {
        if (this.isMounted && this.container && this.container.isConnected) {
          const state = LiveTvRepository.getUiState();
          this.render();
          // render() now handles building nav model and focusing first channel card
        }
      });
    }
  };
}
