import { Router } from "../../navigation/routerState.js";
import { ScreenUtils } from "../../navigation/screen.js";
import { I18n } from "../../../i18n/index.js";
import { Platform } from "../../../platform/index.js";
import { getTvRuntimePerformanceProfile } from "../../../platform/tvRuntimePerformance.js";
import { LocalStore } from "../../../core/storage/localStore.js";
import { LiveTvRepository } from "../../../features/livetv/LiveTvRepository.js";
import {
  activateLegacySidebarAction,
  bindRootSidebarEvents,
  focusWithoutAutoScroll,
  getRootSidebarNodes,
  getRootSidebarSelectedNode,
  getSidebarProfileState,
  isSelectedSidebarAction,
  isRootSidebarNode,
  renderRootSidebar,
  setModernSidebarExpanded,
  setModernSidebarPillIconOnly,
  setLegacySidebarExpanded
} from "../../components/sidebarNavigation.js";
import { renderLoadingIndicator } from "../../components/loadingIndicator.js";

import { createLiveTvScreenMethods01 } from "./liveTvScreenMethods-01-get-route-state-key.js";
import { createLiveTvScreenMethods02 } from "./liveTvScreenMethods-02-render.js";
import { createLiveTvScreenMethods03 } from "./liveTvScreenMethods-03-load-data.js";
import { createLiveTvScreenMethods04 } from "./liveTvScreenMethods-04-handle-key-down.js";
import { createLiveTvScreenMethods05 } from "./liveTvScreenMethods-05-cleanup.js";
import { createLiveTvScreenMethods06 } from "./liveTvScreenMethods-06-focus-node.js";
import { createLiveTvScreenMethods07 } from "./liveTvScreenMethods-07-on-sidebar-reselect.js";
import { createLiveTvScreenMethods08 } from "./liveTvScreenMethods-08-mount.js";
import { createLiveTvScreenMethods09 } from "./liveTvScreenMethods-09-sidebar.js";

export {
  Router,
  ScreenUtils,
  I18n,
  Platform,
  getTvRuntimePerformanceProfile,
  LocalStore,
  LiveTvRepository,
  activateLegacySidebarAction,
  bindRootSidebarEvents,
  focusWithoutAutoScroll,
  getRootSidebarNodes,
  getRootSidebarSelectedNode,
  getSidebarProfileState,
  isSelectedSidebarAction,
  isRootSidebarNode,
  renderRootSidebar,
  setModernSidebarExpanded,
  setModernSidebarPillIconOnly,
  setLegacySidebarExpanded,
  renderLoadingIndicator
};

const _methods01 = createLiveTvScreenMethods01();
const _methods02 = createLiveTvScreenMethods02();
const _methods03 = createLiveTvScreenMethods03();
const _methods04 = createLiveTvScreenMethods04();
const _methods05 = createLiveTvScreenMethods05();
const _methods06 = createLiveTvScreenMethods06();
const _methods07 = createLiveTvScreenMethods07();
const _methods08 = createLiveTvScreenMethods08();
const _methods09 = createLiveTvScreenMethods09();

export const LiveTvScreen = {
  ..._methods01,
  ..._methods02,
  ..._methods03,
  ..._methods04,
  ..._methods05,
  ..._methods06,
  ..._methods07,
  ..._methods08,
  ..._methods09,
  mount: _methods08.mount,
  unmount: _methods08.unmount
};
