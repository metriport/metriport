import { z } from "zod";

// https://cronometer.com/developer/docs/openapi.html#operation/post-diary_summary
export const cronometerMacrosResp = z.object({
  alcohol: z.number(),
  fat: z.number(),
  fiber: z.number(),
  kcal: z.number(),
  magnesium: z.number(),
  net_carbs: z.number(),
  potassium: z.number(),
  protein: z.number(),
  sodium: z.number(),
  total_carbs: z.number(),
});

export type CronometerMacros = z.infer<typeof cronometerMacrosResp>;
