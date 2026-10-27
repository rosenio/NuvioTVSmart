import {
  setModernSidebarExpanded,
  setModernSidebarPillIconOnly,
  setLegacySidebarExpanded,
  activateLegacySidebarAction
} from "../../components/sidebarNavigation.js";
import { LocalStore } from "../../../core/storage/localStore.js";
import { Router } from "../../navigation/routerState.js";
import { LiveTvRepository } from "../../../features/livetv/LiveTvRepository.js";

export function createLiveTvScreenMethods09() {
  return {
    onSelectedAction(node) {
      const action = node?.dataset?.action || "";
      const currentRoute = Router?.getCurrent?.() || "";
      // Don't close sidebar/focus if action is for current route (already selected)
      if (action === "gotoLiveTv" && currentRoute === "livetv") {
        return;
      }
      this.closeSidebarToContent();
    },

    onExpandSidebar() {
      this.openSidebar();
    },

    closeSidebarToContent() {
      const isModern = LocalStore.get("modernSidebar", false);
      if (isModern) {
        setModernSidebarExpanded(this.container, false);
        setModernSidebarPillIconOnly(this.container, false);
      } else {
        setLegacySidebarExpanded(this.container, false);
      }
      // Focus handled in loadData subscription when channels load
      // But if channels already exist (cached), focus now
      const state = LiveTvRepository.getUiState();
      if (state.channels && state.channels.length > 0) {
        requestAnimationFrame(() => this.focusContentNode());
      }
    },

    openSidebar() {
      const isModern = LocalStore.get("modernSidebar", false);
      if (isModern) {
        setModernSidebarExpanded(this.container, true);
      } else {
        setLegacySidebarExpanded(this.container, true);
      }
      this.focusSidebarNode();
    }
  };
}
