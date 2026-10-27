import { I18n } from "../../../i18n/index.js";
import { LocalStore } from "../../../core/storage/localStore.js";
import { LiveTvRepository } from "../../../features/livetv/LiveTvRepository.js";
import { createLiveTvSettingsMethods01 } from "./liveTvSettingsMethods-01-render.js";
import { createLiveTvSettingsMethods02 } from "./liveTvSettingsMethods-02-bind-events.js";

export const LiveTvSettingsSection = {
  ...createLiveTvSettingsMethods01(),
  ...createLiveTvSettingsMethods02()
};
