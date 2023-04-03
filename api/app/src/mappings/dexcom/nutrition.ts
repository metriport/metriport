import { Nutrition } from "@metriport/api";
import { sum } from "lodash";

import { DexcomEvents } from "./models/events";
import { PROVIDER_DEXCOM } from "../../shared/constants";

export const mapToNutrition = (dexcomBiometrics: DexcomEvents, date: string): Nutrition => {
  const metadata = {
    date: date,
    source: PROVIDER_DEXCOM,
  };

  const nutrition: Nutrition = {
    metadata: metadata,
  };

  const carbEventType = "carbs";

  const carbsValues = dexcomBiometrics.records.flatMap(record =>
    record.eventType === carbEventType ? Number(record.value) : []
  );

  nutrition.summary = {
    macros: {
      carbs_g: sum(carbsValues),
    },
  };

  return nutrition;
};
