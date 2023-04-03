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

  const carbsValues = dexcomBiometrics.records.reduce((acc: number[], curr) => {
    const carbEventType = "carbs";

    if (curr.eventType === carbEventType) {
      acc.push(Number(curr.value));
    }

    return acc;
  }, []);

  nutrition.summary = {
    macros: {
      carbs_g: sum(carbsValues),
    },
  };

  return nutrition;
};
