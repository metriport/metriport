import { Nutrition } from "@metriport/api";
import convert from "convert-units";

import { PROVIDER_GOOGLE } from "../../shared/constants";
import { GoogleNutrition } from "./models/nutrition";
import { Util } from "../../shared/util";
import { getValues } from ".";
import { GooglePoint } from "./models";

export const mapToNutrition = (googleNutrition: GoogleNutrition, date: string): Nutrition => {
  const metadata = {
    date: date,
    source: PROVIDER_GOOGLE,
  };

  let nutrition: Nutrition = {
    metadata: metadata,
  };

  googleNutrition.bucket[0].dataset.forEach((data) => {
    if (data.point.length) {
      const values = getValues(data.point);

      if (data.dataSourceId === "derived:com.google.hydration:com.google.android.gms:merged") {
        nutrition.summary = {
          macros: {
            water_ml: convert(Util.getAvgOfArr(values, 3)).from('l').to("ml")
          }
        }
      }

      if (data.dataSourceId === "derived:com.google.nutrition:com.google.android.gms:merged") {
        const macros = getMacros(data.point);

        nutrition.summary = {
          macros: {
            ...nutrition.summary?.macros,
            fat_g: macros["fat.total"],
            protein_g: macros["protein"],
            carbs_g: macros["carbs.total"],
            energy_kcal: macros["calories"],
            sugar_g: macros["sugar"],
            fiber_g: macros["dietary_fiber"]
          }
        }
      }
    }
  })

  return nutrition;
};

const getMacros = (arr: GooglePoint) => {
  return arr.reduce((acc, curr) => {
    curr.value[0].mapVal.forEach((val) => {
      if (val.value.fpVal) {
        if (acc[val.key]) {
          acc[val.key] = acc[val.key] + val.value.fpVal
        } else {
          acc[val.key] = val.value.fpVal
        }
      }
    })

    return acc
  }, {} as { [key: string]: number })
}