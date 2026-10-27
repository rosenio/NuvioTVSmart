import {
  setModernSidebarExpanded,
  setModernSidebarPillIconOnly,
  setLegacySidebarExpanded,
  activateLegacySidebarAction
} from "../../components/sidebarNavigation.js";

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
        setModernSidebarExpanded(false);
        setModernSidebarPillIconOnly(false);
      } else {
        setLegacySidebarExpanded(false);
      }
      this.focusContentNode();
    },

    openSidebar() {
      const isModern = LocalStore.get("modernSidebar", false);
      if (isModern) {
        setModernSidebarExpanded(true);
      } else {
        setLegacySidebarExpanded(true);
      }
      this.focusSidebarNode();
    }
  };
}
