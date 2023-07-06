import { z } from "zod";
import { googleResp } from ".";

export const sourceIdWeight = "derived:com.google.weight:com.google.android.gms:merge_weight";
export const sourceIdHeight = "derived:com.google.height:com.google.android.gms:merge_height";
export const sourceIdBodyFat =
  "derived:com.google.body.fat.percentage:com.google.android.gms:merged";

export const googleBodyDataSourceId = z.enum([sourceIdWeight, sourceIdHeight, sourceIdBodyFat]);

export const googleBodyResp = googleResp(googleBodyDataSourceId);

export type GoogleBody = z.infer<typeof googleBodyResp>;
