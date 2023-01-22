import { z } from "zod"
import { googleResp } from ".";

export const googleBodyDataSourceId = z.enum([
  "derived:com.google.weight:com.google.android.gms:merge_weight",
  "derived:com.google.height:com.google.android.gms:merge_height",
  "derived:com.google.body.fat.percentage:com.google.android.gms:merged",
]);

export const googleBodyResp = googleResp(googleBodyDataSourceId)

export type GoogleBody = z.infer<typeof googleBodyResp>;

