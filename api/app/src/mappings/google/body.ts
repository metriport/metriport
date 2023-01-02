import { Body } from "@metriport/api";
import convert from "convert-units";

import { PROVIDER_GOOGLE } from "../../shared/constants";
import { GoogleBody } from "./models/body";

export const mapToBody = (googleBody: GoogleBody, date: string): Body => {
  const metadata = {
    date: date,
    source: PROVIDER_GOOGLE,
  };

  let body: Body = {
    metadata: metadata,
  };

  if (googleBody.bucket[0].dataset[0].point.length) {
    body.weight_kg = googleBody.bucket[0].dataset[0].point[0].value[0].fpVal;
  }

  return body;
};
