import {
  activateLegacySidebarAction,
  focusWithoutAutoScroll,
  getRootSidebarNodes,
  getRootSidebarSelectedNode,
  isRootSidebarNode
} from "../../components/sidebarNavigation.js";

export function createLiveTvScreenMethods04() {
  return {
    onKeyDown(event) {
      const keyCode = event.keyCode || 0;
      const focusedNode = document.activeElement;

      // Handle sidebar navigation
      if (isRootSidebarNode(focusedNode)) {
        if (keyCode === 37) {
          // Left - close sidebar and focus content
          event.preventDefault();
          this.closeSidebarToContent();
          return true;
        }
        if (keyCode === 39) {
          // Right - close sidebar and focus content
          event.preventDefault();
          this.closeSidebarToContent();
          return true;
        }
      }

      // Handle search input
      const searchInput = this.container?.querySelector(".library-cloud-search-input, .livetv-search-input");
      if (searchInput && searchInput === focusedNode) {
        if (keyCode === 27) {
          // Escape
          event.preventDefault();
          this.searchQuery = "";
          this.render();
          return true;
        }
        return false; // Let input handle other keys
      }

      // Handle category dropdown (new library-style)
      const dropdownOpen = this.container?.querySelector(".livetv-category-dropdown-menu:not([hidden]), .library-picker-menu:not([hidden])");
      if (dropdownOpen) {
        if (keyCode === 27) {
          // Escape
          event.preventDefault();
          const toggleBtn = this.container.querySelector('[data-action="toggle-category-dropdown"]');
          dropdownOpen.hidden = true;
          toggleBtn?.setAttribute("aria-expanded", "false");
          toggleBtn?.focus();
          return true;
        }
        if (keyCode === 40 || keyCode === 38) {
          // Down/Up
          event.preventDefault();
          const options = dropdownOpen.querySelectorAll(".livetv-category-option, .library-picker-option");
          const currentIndex = Array.from(options).findIndex((o) => o === focusedNode);
          let nextIndex = currentIndex;
          if (keyCode === 40) nextIndex = Math.min(options.length - 1, currentIndex + 1);
          if (keyCode === 38) nextIndex = Math.max(0, currentIndex - 1);
          if (nextIndex !== currentIndex) {
            options[nextIndex]?.focus();
          }
          return true;
        }
        if (keyCode === 13) {
          // Enter
          event.preventDefault();
          focusedNode?.click();
          return true;
        }
      }

      // Handle channel list navigation
      const channelCards = this.container?.querySelectorAll(".livetv-channel-card, .livetv-recent-channel");
      if (channelCards.length > 0) {
        const currentIndex = Array.from(channelCards).findIndex((c) => c === focusedNode || c.contains(focusedNode));
        if (currentIndex >= 0) {
          if (keyCode === 40) {
            // Down
            event.preventDefault();
            const nextIndex = Math.min(channelCards.length - 1, currentIndex + 1);
            channelCards[nextIndex]?.focus();
            // Check if we need to append more channels
            this.maybeAppendChunkOnFocus(nextIndex);
            return true;
          }
          if (keyCode === 38) {
            // Up
            event.preventDefault();
            const prevIndex = Math.max(0, currentIndex - 1);
            channelCards[prevIndex]?.focus();
            return true;
          }
          if (keyCode === 39) {
            // Right - focus action buttons
            event.preventDefault();
            const card = channelCards[currentIndex];
            const playBtn = card.querySelector(".livetv-play-btn");
            playBtn?.focus();
            return true;
          }
          if (keyCode === 13 || keyCode === 32) {
            // Enter/Space - play
            event.preventDefault();
            const card = channelCards[currentIndex];
            const playBtn = card.querySelector('[data-action="play-channel"], [data-action="play-recent"]');
            playBtn?.click();
            return true;
          }
        }
      }

      // Handle action buttons (favorite, play)
      const actionBtns = this.container?.querySelectorAll(".livetv-favorite-btn, .livetv-play-btn, .livetv-recent-play");
      if (actionBtns.length > 0) {
        const currentIndex = Array.from(actionBtns).findIndex((b) => b === focusedNode);
        if (currentIndex >= 0) {
          if (keyCode === 37) {
            // Left - back to channel card
            event.preventDefault();
            const btn = actionBtns[currentIndex];
            const card = btn.closest(".livetv-channel-card, .livetv-recent-channel");
            card?.focus();
            return true;
          }
          if (keyCode === 40 || keyCode === 38) {
            // Down/Up between action buttons
            event.preventDefault();
            let nextIndex = currentIndex;
            if (keyCode === 40) nextIndex = Math.min(actionBtns.length - 1, currentIndex + 1);
            if (keyCode === 38) nextIndex = Math.max(0, currentIndex - 1);
            if (nextIndex !== currentIndex) {
              actionBtns[nextIndex]?.focus();
            }
            return true;
          }
        }
      }

      // Handle filter view mode buttons (library style)
      const filterButtons = this.container?.querySelectorAll(".library-view-mode-button");
      if (filterButtons.length > 0) {
        const currentIndex = Array.from(filterButtons).findIndex((c) => c === focusedNode);
        if (currentIndex >= 0) {
          if (keyCode === 39) {
            // Right
            event.preventDefault();
            const nextIndex = Math.min(filterButtons.length - 1, currentIndex + 1);
            filterButtons[nextIndex]?.focus();
            return true;
          }
          if (keyCode === 37) {
            // Left
            event.preventDefault();
            const prevIndex = Math.max(0, currentIndex - 1);
            filterButtons[prevIndex]?.focus();
            return true;
          }
        }
      }

      // Handle category picker anchor
      const categoryAnchor = this.container?.querySelector(".library-picker-anchor[data-action='toggle-category-dropdown']");
      if (categoryAnchor && categoryAnchor === focusedNode) {
        if (keyCode === 13 || keyCode === 32) {
          // Enter/Space - toggle dropdown
          event.preventDefault();
          categoryAnchor.click();
          return true;
        }
        if (keyCode === 39) {
          // Right - go to channel count or search
          event.preventDefault();
          const nextFocusable = this.container?.querySelector(".library-cloud-search-input");
          nextFocusable?.focus();
          return true;
        }
        if (keyCode === 40 || keyCode === 38) {
          // Down/Up - open dropdown
          event.preventDefault();
          categoryAnchor.click();
          return true;
        }
      }

      // Handle dropdown options when open
      const openDropdown = this.container?.querySelector(".library-picker-menu:not([hidden])");
      if (openDropdown) {
        const options = Array.from(openDropdown.querySelectorAll(".library-picker-option"));
        const currentIndex = options.findIndex((c) => c === focusedNode);
        if (currentIndex >= 0) {
          if (keyCode === 13 || keyCode === 32) {
            // Enter/Space - select category
            event.preventDefault();
            options[currentIndex].click();
            return true;
          }
          if (keyCode === 40) {
            // Down
            event.preventDefault();
            const nextIndex = Math.min(options.length - 1, currentIndex + 1);
            options[nextIndex]?.focus();
            return true;
          }
          if (keyCode === 38) {
            // Up
            event.preventDefault();
            const prevIndex = Math.max(0, currentIndex - 1);
            options[prevIndex]?.focus();
            return true;
          }
          if (keyCode === 27) {
            // Escape - close dropdown
            event.preventDefault();
            categoryAnchor?.click();
            categoryAnchor?.focus();
            return true;
          }
        }
      }

      return false;
    }
  };
}
