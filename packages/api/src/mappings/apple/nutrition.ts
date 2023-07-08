import { Nutrition } from "@metriport/api-sdk";
import dayjs from "dayjs";

import { AppleHealth, AppleHealthItem, createMetadata } from ".";

enum NutritionSource {
  macros = "macros",
  micros = "micros",
}

export function mapDataToNutrition(data: AppleHealth, hourly: boolean) {
  const nutrition: Nutrition[] = [];
  const dateToIndex: { [key: string]: number } = {};

  const addToNutrition = (appleItem: AppleHealthItem, sourceKey: NutritionSource, key: string) => {
    const date = dayjs(appleItem.date).format();
    const index = dateToIndex[date];

    if (index || index === 0) {
      nutrition[index] = {
        ...nutrition[index],
        summary: {
          ...nutrition[index].summary,
          [sourceKey]: {
            ...nutrition[index].summary?.[sourceKey],
            [key]: appleItem.value,
          },
        },
      };
      return;
    }

    dateToIndex[date] = nutrition.length;

    nutrition.push({
      metadata: createMetadata(date, hourly),
      summary: {
        [sourceKey]: {
          [key]: appleItem.value,
        },
      },
    });
  };

  // MACROS
  data.HKQuantityTypeIdentifierDietaryCarbohydrates?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.micros, "carbs_g")
  );
  data.HKQuantityTypeIdentifierDietaryCholesterol?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.macros, "cholesterol_mg")
  );
  data.HKQuantityTypeIdentifierDietaryEnergyConsumed?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.micros, "energy_kcal")
  );
  data.HKQuantityTypeIdentifierDietaryFatTotal?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.macros, "fat_g")
  );
  data.HKQuantityTypeIdentifierDietaryFiber?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.macros, "fiber_g")
  );
  data.HKQuantityTypeIdentifierDietaryProtein?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.macros, "protein_g")
  );
  data.HKQuantityTypeIdentifierDietarySodium?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.macros, "sodium_g")
  );
  data.HKQuantityTypeIdentifierDietarySugar?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.macros, "sugar_g")
  );
  data.HKQuantityTypeIdentifierDietaryWater?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.macros, "water_ml")
  );

  // MICROS
  data.HKQuantityTypeIdentifierDietaryCaffeine?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.macros, "caffeine_mg")
  );
  data.HKQuantityTypeIdentifierDietaryCalcium?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.micros, "calcium_mg")
  );
  data.HKQuantityTypeIdentifierDietaryCopper?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.micros, "copper_mg")
  );
  data.HKQuantityTypeIdentifierDietaryFolate?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.micros, "folate_mg")
  );
  data.HKQuantityTypeIdentifierDietaryIodine?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.micros, "iodine_mg")
  );
  data.HKQuantityTypeIdentifierDietaryMagnesium?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.micros, "magnesium_mg")
  );
  data.HKQuantityTypeIdentifierDietaryManganese?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.micros, "manganese_mg")
  );
  data.HKQuantityTypeIdentifierDietaryNiacin?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.micros, "vitamin_B3_mg")
  );
  data.HKQuantityTypeIdentifierDietaryPantothenicAcid?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.micros, "vitamin_B5_mg")
  );
  data.HKQuantityTypeIdentifierDietaryPhosphorus?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.micros, "phosphorus_mg")
  );
  data.HKQuantityTypeIdentifierDietaryPotassium?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.micros, "potassium_mg")
  );
  data.HKQuantityTypeIdentifierDietaryRiboflavin?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.micros, "vitamin_B2_mg")
  );
  data.HKQuantityTypeIdentifierDietarySelenium?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.micros, "selenium_mg")
  );
  data.HKQuantityTypeIdentifierDietaryThiamin?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.micros, "vitamin_B1_mg")
  );
  data.HKQuantityTypeIdentifierDietaryVitaminA?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.micros, "vitamin_A_mg")
  );
  data.HKQuantityTypeIdentifierDietaryVitaminB6?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.micros, "vitamin_B6_mg")
  );
  data.HKQuantityTypeIdentifierDietaryVitaminB12?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.micros, "vitamin_B12_mg")
  );
  data.HKQuantityTypeIdentifierDietaryVitaminC?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.micros, "vitamin_C_mg")
  );
  data.HKQuantityTypeIdentifierDietaryVitaminD?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.micros, "vitamin_D_mg")
  );
  data.HKQuantityTypeIdentifierDietaryVitaminE?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.micros, "vitamin_E_mg")
  );
  data.HKQuantityTypeIdentifierDietaryVitaminK?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.micros, "vitamin_K_mg")
  );
  data.HKQuantityTypeIdentifierDietaryZinc?.forEach(appleItem =>
    addToNutrition(appleItem, NutritionSource.micros, "zinc_mg")
  );

  return nutrition;
}
