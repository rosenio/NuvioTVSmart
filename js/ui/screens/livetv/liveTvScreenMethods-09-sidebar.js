import {
  setModernSidebarExpanded,
  setModernSidebarPillIconOnly,
  setLegacySidebarExpanded,
  activateLegacySidebarAction
} from "../../components/sidebarNavigation.js";
import { LocalStore } from "../../../core/storage/localStore.js";

export function createLiveTvScreenMethods09() {
  return {
    onSelectedAction() {
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
      this.focusContentNode();
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
