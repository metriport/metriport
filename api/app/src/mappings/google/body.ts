import { Body } from "@metriport/api";
import convert from "convert-units";

import { PROVIDER_GOOGLE } from "../../shared/constants";
import { GoogleBody } from "./models/body";

const sourceIdWeight = 'derived:com.google.weight:com.google.android.gms:merge_weight';
const sourceIdHeight = 'derived:com.google.height:com.google.android.gms:merge_height';
const sourceIdBodyFat = 'derived:com.google.body.fat.percentage:com.google.android.gms:merged';

export const mapToBody = (googleBody: GoogleBody, date: string): Body => {
  const metadata = {
    date: date,
    source: PROVIDER_GOOGLE,
  };

  let body: Body = {
    metadata: metadata,
  };

  googleBody.bucket[0].dataset.forEach((data) => {
    if (data.point.length) {
      const dataPoint = data.point[0];
      if (data.dataSourceId === sourceIdWeight) {
        body.weight_kg = dataPoint.value[0].fpVal;
      }

      if (data.dataSourceId === sourceIdHeight) {
        body.height_cm = convert(dataPoint.value[0].fpVal).from("m").to("cm");
      }

      if (data.dataSourceId === sourceIdBodyFat) {
        body.body_fat_pct = dataPoint.value[0].fpVal;
      }
    }
  })

  return body;
};
