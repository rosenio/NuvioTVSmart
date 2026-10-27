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

    closeSidebarToContent({ forPlayback = false } = {}) {
      const isModern = LocalStore.get("modernSidebar", false);
      if (isModern) {
        if (forPlayback) {
          this.hideSidebarForPlayback();
        } else {
          setModernSidebarExpanded(this.container, false);
          setModernSidebarPillIconOnly(this.container, false);
        }
      } else {
        setLegacySidebarExpanded(this.container, false);
      }
      // Use new navigation system to focus first channel card
      requestAnimationFrame(() => {
        this.buildNavModel();
        if (this.navModel?.rows?.[0]?.[0]) {
          this.focusNode(null, this.navModel.rows[0][0]);
        }
      });
    },

    hideSidebarForPlayback() {
      const shell = this.container?.querySelector(".modern-sidebar-shell");
      if (shell) {
        shell.classList.add("hidden");
        // Ensure panel and pill are hidden
        const panel = shell.querySelector(".modern-sidebar-panel");
        const pill = shell.querySelector(".modern-sidebar-pill");
        if (panel) panel.setAttribute("aria-hidden", "true");
        if (pill) pill.setAttribute("aria-expanded", "false");
      }
    },

    restoreSidebarFromPlayback() {
      const shell = this.container?.querySelector(".modern-sidebar-shell");
      if (shell) {
        shell.classList.remove("hidden");
        // Restore normal collapsed state
        const isModern = LocalStore.get("modernSidebar", false);
        if (isModern) {
          setModernSidebarExpanded(this.container, false);
          setModernSidebarPillIconOnly(this.container, false);
        }
      }
    },

    openSidebar() {
      const isModern = LocalStore.get("modernSidebar", false);
      if (isModern) {
        setModernSidebarExpanded(this.container, true);
      } else {
        setLegacySidebarExpanded(this.container, true);
      }
      // Use new navigation system to focus first sidebar item
      requestAnimationFrame(() => {
        this.buildNavModel();
        if (this.navModel?.sidebar?.[0]) {
          this.focusNode(null, this.navModel.sidebar[0]);
        }
      });
    }
  };
}
