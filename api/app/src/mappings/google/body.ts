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

  googleBody.bucket[0].dataset.forEach((data) => {
    const dataPoint = data.point[0];
    if (dataPoint.dataTypeName === 'com.google.weight') {
      body.weight_kg = dataPoint.value[0].fpVal;
    }

    if (dataPoint.dataTypeName === 'com.google.height') {
      body.height_cm = convert(dataPoint.value[0].fpVal).from("m").to("cm");
    }

    if (dataPoint.dataTypeName === 'com.google.body.fat.percentage') {
      body.body_fat_pct = dataPoint.value[0].fpVal;
    }
  })

  return body;
};
