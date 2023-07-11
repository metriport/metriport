import { Body } from "@metriport/api-sdk";
import convert from "convert-units";

import { PROVIDER_OURA } from "../../shared/constants";
import { OuraPersonalInfo } from "./user";

export const mapToBody = (ouraPersonalInfo: OuraPersonalInfo, date: string): Body => {
  const metadata = {
    date: date,
    source: PROVIDER_OURA,
  };

  const body: Body = {
    metadata: metadata,
  };

  if (ouraPersonalInfo.height) {
    body.height_cm = convert(ouraPersonalInfo.height).from("m").to("cm");
  }

  if (ouraPersonalInfo.weight) {
    body.weight_kg = ouraPersonalInfo.weight;
  }

  return body;
};
