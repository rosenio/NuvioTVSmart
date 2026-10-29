function getDirectionFromKeyCode(keyCode) {
  switch (Number(keyCode || 0)) {
    case 37:
      return "left";
    case 38:
      return "up";
    case 39:
      return "right";
    case 40:
      return "down";
    default:
      return null;
  }
}

function isTextField(node) {
  const tagName = String(node?.tagName || "").toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

export function createLiveTvScreenMethods10() {
  return {
    getDirectionalRepeatThrottleMs(direction) {
      if (direction === "up" || direction === "down") {
        return 140;
      }
      return 120;
    },

    buildNavModel() {
      const sidebar = this.container?.querySelector(".home-sidebar .focusable, .modern-sidebar-panel .focusable")
        ? Array.from(this.container.querySelectorAll(".home-sidebar .focusable, .modern-sidebar-panel .focusable"))
        : [];
      const contentRoot = this.container?.querySelector(".livetv-content") || this.container;
      // Row 0: Last watched (recent channel) - if exists
      const recentChannels = Array.from(contentRoot.querySelectorAll(".livetv-recent-channel"));
      // Row 1: Filter bar elements (library-style)
      const viewModeButtons = Array.from(contentRoot.querySelectorAll(".library-view-mode-button"));
      const categoryPicker = Array.from(contentRoot.querySelectorAll(".library-picker-anchor"));
      const searchInput = Array.from(contentRoot.querySelectorAll(".library-cloud-search-input"));
      const filterBarFocusables = [...viewModeButtons, ...categoryPicker, ...searchInput];
      // Row 2: Channel cards
      const channelCards = Array.from(contentRoot.querySelectorAll(".livetv-channel-card"));
      // Row 3: Action buttons
      const actionBtns = Array.from(contentRoot.querySelectorAll(".livetv-favorite-btn, .livetv-play-btn, .livetv-recent-play"));
      const refreshBtn = contentRoot.querySelector('[data-action="refresh"]:not(.home-nav-item)');
      const gotoSettingsBtn = contentRoot.querySelector('[data-action="gotoSettings"]:not(.home-nav-item)');
      // Row 4: Dropdown options (only when dropdown is open)
      const dropdownOpen = contentRoot.querySelector(".library-picker-menu:not([hidden])");
      const dropdownOptions = dropdownOpen ? Array.from(dropdownOpen.querySelectorAll(".library-picker-option")) : [];

      const rows = [];
      if (recentChannels.length) rows.push(recentChannels);
      if (filterBarFocusables.length) rows.push(filterBarFocusables);
      if (channelCards.length) rows.push(channelCards);
      if (actionBtns.length || refreshBtn || gotoSettingsBtn) {
        const actionRow = [];
        if (actionBtns.length) actionRow.push(...actionBtns);
        if (refreshBtn) actionRow.push(refreshBtn);
        if (gotoSettingsBtn) actionRow.push(gotoSettingsBtn);
        rows.push(actionRow);
      }
      if (dropdownOptions.length) rows.push(dropdownOptions);

      sidebar.forEach((node, index) => {
        node.dataset.navZone = "sidebar";
        node.dataset.navIndex = String(index);
      });

      rows.forEach((rowNodes, rowIndex) => {
        rowNodes.forEach((node, colIndex) => {
          node.dataset.navZone = "main";
          node.dataset.navRow = String(rowIndex);
          node.dataset.navCol = String(colIndex);
        });
      });

      this.navModel = { sidebar, rows };
      if (!this.lastMainFocus || !this.container?.contains(this.lastMainFocus)) {
        this.lastMainFocus = rows[0]?.[0] || null;
      }
    },

    isSidebarNode(node) {
      return node?.dataset?.navZone === "sidebar";
    },

    isMainNode(node) {
      return node?.dataset?.navZone === "main";
    },

    getCurrentFocusedNode() {
      return this.container?.querySelector(".focusable.focused") || document.activeElement;
    },

    focusWithoutAutoScroll(node, options = {}) {
      try {
        node.focus({ preventScroll: true });
      } catch (_) {
        try {
          node.focus();
        } catch (_) {}
      }
    },

    focusNode(current, target, direction = null, inputMeta = null) {
      if (!target) return false;
      if (current && current !== target) {
        current.classList.remove("focused");
      }
      target.classList.add("focused");
      this.focusWithoutAutoScroll(target, { suppressDelegatedFocus: true });
      if (this.isMainNode(target)) {
        this.lastMainFocus = target;
      }
      return true;
    },

    handleLiveTvDpad(event) {
      const keyCode = Number(event?.keyCode || 0);
      const direction = getDirectionFromKeyCode(keyCode);
      if (!direction) return false;

      const nav = this.navModel;
      if (!nav) return false;

      let current = this.getCurrentFocusedNode();
      if (!current) return false;
      const isSidebar = this.isSidebarNode(current);

      if (typeof event?.preventDefault === "function") {
        event.preventDefault();
      }

      const inputMeta = { repeat: Boolean(event?.repeat) };

      if (inputMeta.repeat && !isSidebar && (direction === "up" || direction === "down")) {
        const now = Date.now();
        const repeatThrottleMs = this.getDirectionalRepeatThrottleMs(direction);
        const repeatTimes = this.lastDirectionalKeyAtByDirection || (this.lastDirectionalKeyAtByDirection = {});
        const lastDirectionalKeyAt = Number(repeatTimes[direction] || 0);
        if (lastDirectionalKeyAt > 0 && now - lastDirectionalKeyAt < repeatThrottleMs) {
          return true;
        }
        repeatTimes[direction] = now;
      }

      if (isSidebar) {
        const sidebarIndex = Number(current.dataset.navIndex || 0);
        if (direction === "up") {
          const target = nav.sidebar[Math.max(0, sidebarIndex - 1)] || current;
          return this.focusNode(current, target, direction, inputMeta) || true;
        }
        if (direction === "down") {
          const target = nav.sidebar[Math.min(nav.sidebar.length - 1, sidebarIndex + 1)] || current;
          return this.focusNode(current, target, direction, inputMeta) || true;
        }
        if (direction === "right") {
          return this.closeSidebarToContent() || true;
        }
        return true;
      }

      const row = Number(current.dataset.navRow || 0);
      const col = Number(current.dataset.navCol || 0);
      const rowNodes = nav.rows[row] || [];

      if (direction === "left") {
        const targetInRow = rowNodes[col - 1] || null;
        if (this.focusNode(current, targetInRow, direction, inputMeta)) return true;
        const sidebarFallback = nav.sidebar[0] || null;
        return this.focusNode(current, sidebarFallback, direction, inputMeta) || true;
      }

      if (direction === "right") {
        const target = rowNodes[col + 1] || null;
        return this.focusNode(current, target, direction, inputMeta) || true;
      }

      if (direction === "up" || direction === "down") {
        const delta = direction === "up" ? -1 : 1;
        const targetRow = row + delta;
        const targetRowNodes = nav.rows[targetRow] || null;
        if (!targetRowNodes || !targetRowNodes.length) return true;
        const target = targetRowNodes[Math.min(col, targetRowNodes.length - 1)] || targetRowNodes[0];
        return this.focusNode(current, target, direction, inputMeta) || true;
      }

      return false;
    },

    onKeyDown(event) {
      const keyCode = event.keyCode || 0;
      const focusedNode = document.activeElement;

      // Prevent navigation when focused on text fields (prevents virtual keyboard)
      if (isTextField(focusedNode) && ![37, 38, 39, 40].includes(keyCode)) {
        return false;
      }

      if (this.handleLiveTvDpad(event)) {
        return true;
      }

      // Handle search input - only Escape key, let input handle typing
      const searchInput = this.container?.querySelector(".livetv-search-input");
      if (searchInput && searchInput === focusedNode) {
        if (keyCode === 27) {
          event.preventDefault();
          this.searchQuery = "";
          this.render();
          return true;
        }
        return false; // Let input handle other keys
      }

      // Handle category dropdown - Escape to close
      const dropdownOpen = this.container?.querySelector(".livetv-category-dropdown-menu:not([hidden])");
      if (dropdownOpen && keyCode === 27) {
        event.preventDefault();
        this.categoryDropdownOpen = false;
        this.render();
        return true;
      }

      // Handle Enter/Space on category anchor to toggle dropdown
      const categoryAnchor = this.container?.querySelector(".library-picker-anchor[data-action='toggle-category-dropdown']");
      if (categoryAnchor && categoryAnchor === focusedNode && (keyCode === 13 || keyCode === 32)) {
        event.preventDefault();
        this.categoryDropdownOpen = !this.categoryDropdownOpen;
        if (this.categoryDropdownOpen) this.filterMode = "category";
        this.render();
        return true;
      }

      // Handle dropdown options when open
      if (this.categoryDropdownOpen) {
        const openDropdown = this.container?.querySelector(".library-picker-menu:not([hidden])");
        if (!openDropdown) return true;
        const options = Array.from(openDropdown.querySelectorAll(".library-picker-option"));
        const currentIndex = options.findIndex((c) => c === focusedNode);
        if (currentIndex >= 0) {
          if (keyCode === 13 || keyCode === 32) {
            event.preventDefault();
            options[currentIndex].click();
            return true;
          }
          if (keyCode === 40) {
            event.preventDefault();
            const nextIndex = Math.min(options.length - 1, currentIndex + 1);
            options[nextIndex]?.focus();
            return true;
          }
          if (keyCode === 38) {
            event.preventDefault();
            const prevIndex = Math.max(0, currentIndex - 1);
            options[prevIndex]?.focus();
            return true;
          }
          if (keyCode === 27) {
            event.preventDefault();
            categoryAnchor?.click();
            categoryAnchor?.focus();
            return true;
          }
        }
      }

      // Handle Enter/Space on channel cards for play
      if (this.isMainNode(focusedNode)) {
        const card = focusedNode.closest(".livetv-channel-card, .livetv-recent-channel");
        if (card && (keyCode === 13 || keyCode === 32)) {
          event.preventDefault();
          const playBtn = card.querySelector('[data-action="play-channel"], [data-action="play-recent"]');
          playBtn?.click();
          return true;
        }
      }

      // Handle action buttons (favorite, play) - left goes back to card
      if (
        focusedNode.classList.contains("livetv-favorite-btn") ||
        focusedNode.classList.contains("livetv-play-btn") ||
        focusedNode.classList.contains("livetv-recent-play")
      ) {
        if (keyCode === 37) {
          event.preventDefault();
          const card = focusedNode.closest(".livetv-channel-card, .livetv-recent-channel");
          card?.focus();
          return true;
        }
      }

      return false;
    },

    onKeyUp(event) {
      const keyCode = Number(event?.keyCode || 0);
      const direction = getDirectionFromKeyCode(keyCode);
      if (direction && this.lastDirectionalKeyAtByDirection) {
        delete this.lastDirectionalKeyAtByDirection[direction];
      }
    }
  };
}
