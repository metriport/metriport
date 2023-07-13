import { Nutrition } from "@metriport/api-sdk";
import { sum } from "lodash";

import { DexcomEvents } from "./models/events";
import { PROVIDER_DEXCOM } from "../../shared/constants";

export const mapToNutrition = (dexcomBiometrics: DexcomEvents, date: string): Nutrition => {
  const metadata = {
    date: date,
    source: PROVIDER_DEXCOM,
  };

  const carbEventType = "carbs";

  const carbsValues = dexcomBiometrics.records.flatMap(record =>
    record.eventType === carbEventType ? Number(record.value) : []
  );

  const nutrition: Nutrition = {
    metadata: metadata,
    summary: {
      macros: {
        carbs_g: sum(carbsValues),
      },
    },
  };

  return nutrition;
};
