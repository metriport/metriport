import { z } from "zod";
import { cronometerMacrosResp } from "./macros";

// https://cronometer.com/developer/docs/openapi.html#operation/post-diary_summary
export const cronometerMealResp = z.object({
  name: z.string(),
  foods: z.array(
    z.object({
      name: z.string(),
      serving: z.string(),
    })
  ),
  macros: cronometerMacrosResp,
});

export type CronometerMeal = z.infer<typeof cronometerMealResp>;
