import { z } from "zod"
import { googleResp } from ".";

export const googleActivityDataSourceId = z.enum([
  "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps",
  "derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended",
]);

export const googleActivityResp = googleResp(googleActivityDataSourceId)

export type GoogleActivity = z.infer<typeof googleActivityResp>;
export type GoogleActivityDataSourceId = z.infer<typeof googleActivityDataSourceId>;

