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
          
          // Focus content when channels first appear - defer to next frame for DOM update
          if (!this._hasFocusedContent && state.channels && state.channels.length > 0) {
            this._hasFocusedContent = true;
            requestAnimationFrame(() => this.applyFocus());
          }
        }
      });
    }
  };
}
