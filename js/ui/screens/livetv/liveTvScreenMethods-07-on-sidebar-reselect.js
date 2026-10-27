export function createLiveTvScreenMethods07() {
  return {
    onSidebarReselect() {
      // Scroll to top when reselecting the Live TV tab
      const channelList = this.container?.querySelector(".livetv-channel-list");
      if (channelList) {
        channelList.scrollTop = 0;
      }
      // Focus first channel
      const firstChannel = this.container?.querySelector(".livetv-channel-card, .livetv-recent-channel");
      firstChannel?.focus();
    }
  };
}
