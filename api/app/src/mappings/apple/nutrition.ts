import { Nutrition } from "@metriport/api";
import dayjs from "dayjs";

import { AppleHealth, AppleHealthItem, hasNutrition } from "../../mappings/apple";
import { PROVIDER_APPLE } from "../../shared/constants";

export function mapDataToNutrition(data: AppleHealth) {
  const nutrition: Nutrition[] = []

  const addToNutritionMacros = (appleItem: AppleHealthItem, key: string) => {
    const dateIndex = findDateIndex(nutrition, appleItem);

    if (dateIndex >= 0) {
      nutrition[dateIndex] = {
        ...nutrition[dateIndex],
        summary: {
          ...nutrition[dateIndex].summary,
          macros: {
            ...nutrition[dateIndex].summary?.macros,
            [key]: appleItem.value
          }
        }
      }
      return;
    }

    nutrition.push({
      metadata: {
        date: dayjs(appleItem.date).format("YYYY-MM-DD"),
        source: PROVIDER_APPLE,
      },
      summary: {
        macros: {
          [key]: appleItem.value
        }
      },
    })
  }

  if (hasNutrition(data)) {
    data.HKQuantityTypeIdentifierDietaryCaffeine?.forEach((appleItem) => addToNutritionMacros(appleItem, 'carbs_g'))
    data.HKQuantityTypeIdentifierDietaryCholesterol?.forEach((appleItem) => addToNutritionMacros(appleItem, 'cholesterol_mg'))
    data.HKQuantityTypeIdentifierDietaryFatTotal?.forEach((appleItem) => addToNutritionMacros(appleItem, 'fat_g'))
    data.HKQuantityTypeIdentifierDietaryFiber?.forEach((appleItem) => addToNutritionMacros(appleItem, 'fiber_g'))
    data.HKQuantityTypeIdentifierDietaryProtein?.forEach((appleItem) => addToNutritionMacros(appleItem, 'protein_g'))
    data.HKQuantityTypeIdentifierDietarySodium?.forEach((appleItem) => addToNutritionMacros(appleItem, 'sodium_g'))
    data.HKQuantityTypeIdentifierDietarySugar?.forEach((appleItem) => addToNutritionMacros(appleItem, 'sugar_g'))
    data.HKQuantityTypeIdentifierDietaryWater?.forEach((appleItem) => addToNutritionMacros(appleItem, 'water_ml'))
  }
  return nutrition
}

const findDateIndex = (arr: Nutrition[], appleItem: AppleHealthItem) => {
  return arr.findIndex(nutrition => dayjs(nutrition.metadata.date).format("YYYY-MM-DD") === dayjs(appleItem.date).format("YYYY-MM-DD"))
}