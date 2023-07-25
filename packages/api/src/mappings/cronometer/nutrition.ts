import { Nutrition, Food } from "@metriport/api-sdk";
import { PROVIDER_CRONOMETER } from "../../shared/constants";
import { CronometerDiarySummary } from "./models/diary-summary";

export const mapToNutrition = (diarySummary: CronometerDiarySummary, date: string): Nutrition => {
  const { macros, nutrients, foods } = diarySummary;

  const foodsLog: Food[] = [];

  foods?.forEach(foodArray => {
    foodArray.foods.forEach(foodItem => {
      const consumedAmount = foodItem.serving.split("-");
      foodsLog.push({
        name: foodItem.name,
        amount: parseFloat(consumedAmount[0]),
        unit: consumedAmount[1].trim(),
      });
    });
  });

  return {
    metadata: {
      date: date,
      source: PROVIDER_CRONOMETER,
    },
    summary: {
      // TODO: confirm units
      macros: {
        alcohol_g: macros.alcohol,
        carbs_g: macros.total_carbs,
        cholesterol_mg: nutrients.Cholesterol,
        energy_kcal: macros.kcal,
        fat_g: macros.fat,
        fiber_g: macros.fiber,
        protein_g: macros.protein,
        sodium_mg: macros.sodium,
        sugar_g: nutrients.Sugars,
        trans_fat_g: nutrients["Trans-Fats"],
        water_ml: nutrients.Water,
      },
      micros: {
        caffeine_mg: nutrients.Caffeine,
        calcium_mg: nutrients.Calcium,
        copper_mg: nutrients.Copper,
        folate_mg: nutrients.Folate,
        iron_mg: nutrients.Iron,
        magnesium_mg: nutrients.Magnesium,
        manganese_mg: nutrients.Manganese,
        phosphorus_mg: nutrients.Phosphorus,
        potassium_mg: nutrients.Potassium,
        selenium_mg: nutrients.Selenium,
        vitamin_A_mg: nutrients["Vitamin A"],
        vitamin_B1_mg: nutrients["B1 (Thiamine)"],
        vitamin_B2_mg: nutrients["B2 (Riboflavin)"],
        vitamin_B3_mg: nutrients["B3 (Niacin)"],
        vitamin_B5_mg: nutrients["B5 (Pantothenic Acid)"],
        vitamin_B6_mg: nutrients["B6 (Pyridoxine)"],
        vitamin_B12_mg: nutrients["B12 (Cobalamin)"],
        vitamin_C_mg: nutrients["Vitamin C"],
        vitamin_D_mg: nutrients["Vitamin D"],
        vitamin_E_mg: nutrients["Vitamin E"],
        vitamin_K_mg: nutrients["Vitamin K"],
        zinc_mg: nutrients.Zinc,
      },
      aminos: {
        alanine_g: nutrients.Alanine,
        arginine_g: nutrients.Arginine,
        aspartic_acid_g: nutrients["Aspartic acid"],
        cysteine_g: nutrients.Cystine,
        glutamic_acid_g: nutrients["Glutamic acid"],
        glycine_g: nutrients.Glycine,
        histidine_g: nutrients.Histidine,
        isoleucine_g: nutrients.Isoleucine,
        leucine_g: nutrients.Leucine,
        lysine_g: nutrients.Lysine,
        methionine_g: nutrients.Methionine,
        phenylalanine_g: nutrients.Phenylalanine,
        proline_g: nutrients.Proline,
        serine_g: nutrients.Serine,
        threonine_g: nutrients.Threonine,
        tryptophan_g: nutrients.Tryptophan,
        tyrosine_g: nutrients.Tyrosine,
        valine_g: nutrients.Valine,
      },
    },
    foods: foodsLog,
  };
};
