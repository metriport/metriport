import { makeSetting } from "../../domain/__tests__/settings";
import { Settings } from "../settings";

export const makeSettingModel = (params: { id: string }): Settings =>
  makeSetting(params) as Settings;
