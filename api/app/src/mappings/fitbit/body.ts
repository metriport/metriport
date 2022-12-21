import { Body } from "@metriport/api";
import convert from "convert-units";

import { PROVIDER_FITBIT } from "../../shared/constants";
import { FitbitUser } from "./models/user";

export const mapToBody = (fitbitUser: FitbitUser, date: string): Body => {
  const metadata = {
    date: date,
    source: PROVIDER_FITBIT,
  };

  let body: Body = {
    metadata: metadata,
  };

  if (fitbitUser.user.height && fitbitUser.user.heightUnit === "en_US") {
    body.height_cm = convert(fitbitUser.user.height).from("in").to("cm");
  }

  if (fitbitUser.user.weight && fitbitUser.user.weightUnit === "en_US") {
    body.weight_kg = convert(fitbitUser.user.weight).from("lb").to("kg");
  }

  return body;
};
