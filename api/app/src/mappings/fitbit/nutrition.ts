import { Nutrition } from "@metriport/api";
import { FoodItem } from "@metriport/api/src/devices/models/common/food-item";
import { PROVIDER_FITBIT } from "../../shared/constants";
import { FitbitFood } from "./models/food";
import { FitbitWater } from "./models/water";

export const mapToNutrition = (date: string, food?: FitbitFood, water?: FitbitWater): Nutrition => {
  const metadata = {
    date: date,
    source: PROVIDER_FITBIT,
  };

  const nutrition: Nutrition = {
    metadata: metadata,
    summary: {
      macros: {},
    },
    foods: [] as FoodItem[],
  };

  food?.foods.forEach(foodItem => {
    console.log("item:", foodItem);
  });

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
    food.foods?.forEach(foodItem => {
      const { name, brand, amount, unit } = foodItem.loggedFood;
      const item: FoodItem = {
        name,
        brand,
        amount,
        unit: unit.name,
      };

      if (foodItem.nutritionalValues) {
        item["nutrition_facts"] = {
          macros: {
            energy_kcal: foodItem.nutritionalValues?.calories,
            carbs_g: foodItem.nutritionalValues?.carbs,
            fat_g: foodItem.nutritionalValues?.fat,
            protein_g: foodItem.nutritionalValues?.protein,
            fiber_g: foodItem.nutritionalValues?.fiber,
            sodium_mg: foodItem.nutritionalValues?.sodium,
          },
        };
      }

      nutrition.foods?.push(item);
    });
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
