import { Body as MetriportBody } from "@metriport/api";

import { PROVIDER_OURA } from "../../shared/constants";
import { Util } from "../../shared/util";
import { OuraPersonalInfo } from "./user";

export const mapToBody = (
  ouraPersonalInfo: OuraPersonalInfo,
  date: string
): MetriportBody => {
  return {
    metadata: {
      date: date,
      source: PROVIDER_OURA,
    },
    ...Util.addDataToObject("height_cm", ouraPersonalInfo.height),
    ...Util.addDataToObject("weight_kg", ouraPersonalInfo.weight),
  };
};
