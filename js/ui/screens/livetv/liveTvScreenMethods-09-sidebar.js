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
        if (forPlayback) {
          this.hideSidebarForPlayback();
        } else {
          setLegacySidebarExpanded(this.container, false);
        }
      }
      // Only rebuild nav model and focus if NOT navigating away for playback
      if (!forPlayback) {
        requestAnimationFrame(() => {
          if (!this.container || !this.container.isConnected) return;
          this.buildNavModel();
          if (this.navModel?.rows?.[0]?.[0]) {
            this.focusNode(null, this.navModel.rows[0][0]);
          }
        });
      }
    },

    hideSidebarForPlayback() {
      // Hide modern sidebar
      const modernShell = this.container?.querySelector(".modern-sidebar-shell");
      if (modernShell) {
        modernShell.classList.add("hidden");
        const panel = modernShell.querySelector(".modern-sidebar-panel");
        const pill = modernShell.querySelector(".modern-sidebar-pill");
        if (panel) panel.setAttribute("aria-hidden", "true");
        if (pill) pill.setAttribute("aria-expanded", "false");
      }
      // Hide legacy sidebar
      const legacySidebar = this.container?.querySelector(".home-sidebar");
      if (legacySidebar) {
        legacySidebar.classList.add("hidden");
        legacySidebar.setAttribute("aria-hidden", "true");
      }
    },

    restoreSidebarFromPlayback() {
      // Restore modern sidebar
      const modernShell = this.container?.querySelector(".modern-sidebar-shell");
      if (modernShell) {
        modernShell.classList.remove("hidden");
        const isModern = LocalStore.get("modernSidebar", false);
        if (isModern) {
          setModernSidebarExpanded(this.container, false);
          setModernSidebarPillIconOnly(this.container, false);
        }
      }
      // Restore legacy sidebar
      const legacySidebar = this.container?.querySelector(".home-sidebar");
      if (legacySidebar) {
        legacySidebar.classList.remove("hidden");
        legacySidebar.removeAttribute("aria-hidden");
        setLegacySidebarExpanded(this.container, false);
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
        if (!this.container || !this.container.isConnected) return;
        this.buildNavModel();
        if (this.navModel?.sidebar?.[0]) {
          this.focusNode(null, this.navModel.sidebar[0]);
        }
      });
    }
  };
}
