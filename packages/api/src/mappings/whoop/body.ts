import { Body } from "@metriport/api-sdk";
import { PROVIDER_WHOOP } from "../../shared/constants";
import { WhoopBody } from "./models/body";
import convert from "convert-units";

export const mapToBody = (whoopBody: WhoopBody, date: string): Body => {
  return {
    metadata: {
      date: date,
      source: PROVIDER_WHOOP,
    },
    height_cm: convert(whoopBody.height_meter).from("m").to("cm"),
    weight_kg: whoopBody.weight_kilogram,
    max_possible_heart_rate_bpm: whoopBody.max_heart_rate,
  };
};
