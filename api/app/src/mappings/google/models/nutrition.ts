import { z } from "zod";
import { googleResp } from ".";

export const sourceIdHydration = "derived:com.google.hydration:com.google.android.gms:merged";
export const sourceIdNutrition = "derived:com.google.nutrition:com.google.android.gms:merged";

export const googleNutritionDataSourceId = z.enum([sourceIdHydration, sourceIdNutrition]);

export const googleNutritionResp = googleResp(googleNutritionDataSourceId);

export type GoogleNutrition = z.infer<typeof googleNutritionResp>;
export type GoogleNutritionDataSourceId = z.infer<typeof googleNutritionDataSourceId>;
