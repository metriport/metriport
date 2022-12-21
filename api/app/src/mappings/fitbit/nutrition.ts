import { Nutrition } from "@metriport/api";

import { PROVIDER_FITBIT } from "../../shared/constants";
import { FitbitFood } from "./models/food";
import { FitbitWater } from "./models/water";

export const mapToNutrition = (
  date: string,
  food?: FitbitFood,
  water?: FitbitWater
): Nutrition => {
  const metadata = {
    date: date,
    source: PROVIDER_FITBIT,
  };

  let nutrition: Nutrition = {
    metadata: metadata,
    summary: {
      macros: {},
    },
  };

  if (food) {
    nutrition.summary = {
      ...nutrition.summary,
      macros: {
        ...nutrition.summary?.macros,
        carbs_g: food.summary.carbs,
        fat_g: food.summary.fat,
        fiber_g: food.summary.fiber,
        protein_g: food.summary.protein,
        sodium_mg: food.summary.sodium,
      },
    };
  }

  if (water) {
    nutrition.summary = {
      ...nutrition.summary,
      macros: {
        ...nutrition.summary?.macros,
        water_ml: water.summary.water,
      },
    };
  }

  return nutrition;
};
