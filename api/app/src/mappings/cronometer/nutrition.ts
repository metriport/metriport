import { Nutrition } from "@metriport/api";
import { PROVIDER_CRONOMETER } from "../../shared/constants";
import { CronometerDiarySummary } from "./models/diary-summary";

export const mapToNutrition = (
  diarySummary: CronometerDiarySummary,
  date: string
): Nutrition => {
  return {
    metadata: {
      date: date,
      source: PROVIDER_CRONOMETER,
    },
    summary: {
      // TODO: confirm units
      macros: {
        alcohol_g: diarySummary.macros.alcohol,
        carbs_g: diarySummary.macros.total_carbs,
        cholesterol_mg: diarySummary.nutrients.Cholesterol,
        energy_kcal: diarySummary.macros.kcal,
        fat_g: diarySummary.macros.fat,
        fiber_g: diarySummary.macros.fiber,
        protein_g: diarySummary.macros.protein,
        sodium_mg: diarySummary.macros.sodium,
        sugar_g: diarySummary.nutrients.Sugars,
        trans_fat_g: diarySummary.nutrients["Trans-Fats"],
        water_ml: diarySummary.nutrients.Water,
      },
      micros: {
        caffeine_mg: diarySummary.nutrients.Caffeine,
        calcium_mg: diarySummary.nutrients.Calcium,
        copper_mg: diarySummary.nutrients.Copper,
        folate_mg: diarySummary.nutrients.Folate,
        iron_mg: diarySummary.nutrients.Iron,
        magnesium_mg: diarySummary.nutrients.Magnesium,
        manganese_mg: diarySummary.nutrients.Manganese,
        phosphorus_mg: diarySummary.nutrients.Phosphorus,
        potassium_mg: diarySummary.nutrients.Potassium,
        selenium_mg: diarySummary.nutrients.Selenium,
        vitamin_A_mg: diarySummary.nutrients["Vitamin A"],
        vitamin_B1_mg: diarySummary.nutrients["B1 (Thiamine)"],
        vitamin_B2_mg: diarySummary.nutrients["B2 (Riboflavin)"],
        vitamin_B3_mg: diarySummary.nutrients["B3 (Niacin)"],
        vitamin_B5_mg: diarySummary.nutrients["B5 (Pantothenic Acid)"],
        vitamin_B6_mg: diarySummary.nutrients["B6 (Pyridoxine)"],
        vitamin_B12_mg: diarySummary.nutrients["B12 (Cobalamin)"],
        vitamin_C_mg: diarySummary.nutrients["Vitamin C"],
        vitamin_D_mg: diarySummary.nutrients["Vitamin D"],
        vitamin_E_mg: diarySummary.nutrients["Vitamin E"],
        vitamin_K_mg: diarySummary.nutrients["Vitamin K"],
        zinc_mg: diarySummary.nutrients.Zinc,
      },
      aminos: {
        alanine_g: diarySummary.nutrients.Alanine,
        arginine_g: diarySummary.nutrients.Arginine,
        aspartic_acid_g: diarySummary.nutrients["Aspartic acid"],
        cysteine_g: diarySummary.nutrients.Cystine,
        glutamic_acid_g: diarySummary.nutrients["Glutamic acid"],
        glycine_g: diarySummary.nutrients.Glycine,
        histidine_g: diarySummary.nutrients.Histidine,
        isoleucine_g: diarySummary.nutrients.Isoleucine,
        leucine_g: diarySummary.nutrients.Leucine,
        lysine_g: diarySummary.nutrients.Lysine,
        methionine_g: diarySummary.nutrients.Methionine,
        phenylalanine_g: diarySummary.nutrients.Phenylalanine,
        proline_g: diarySummary.nutrients.Proline,
        serine_g: diarySummary.nutrients.Serine,
        threonine_g: diarySummary.nutrients.Threonine,
        tryptophan_g: diarySummary.nutrients.Tryptophan,
        tyrosine_g: diarySummary.nutrients.Tyrosine,
        valine_g: diarySummary.nutrients.Valine,
      },
    },
  };
};
