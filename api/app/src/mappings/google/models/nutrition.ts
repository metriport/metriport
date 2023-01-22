import { z } from "zod"
import { googleResp } from ".";

export const googleNutritionDataSourceId = z.enum([
  "derived:com.google.hydration:com.google.android.gms:merged",
  "derived:com.google.nutrition:com.google.android.gms:merged"
]);

export const googleNutritionResp = googleResp(googleNutritionDataSourceId)

export type GoogleNutrition = z.infer<typeof googleNutritionResp>;
export type GoogleNutritionDataSourceId = z.infer<typeof googleNutritionDataSourceId>;

