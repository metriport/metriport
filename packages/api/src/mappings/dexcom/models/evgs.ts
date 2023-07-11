import { z } from "zod";
import { dexcomResp, baseRecordSchema } from ".";

// https://developer.dexcom.com/docs/dexcomv3/operation/getEstimatedGlucoseValuesV3/
export const recordSchema = z
  .object({
    transmitterId: z.string().nullable().optional(),
    transmitterTicks: z.number(),
    value: z.number().nullable().optional(),
    status: z.string().nullable().optional(),
    trend: z.string().nullable().optional(),
    trendRate: z.number().nullable().optional(),
    unit: z.string(),
    rateUnit: z.string(),
  })
  .merge(baseRecordSchema);

export type Record = z.infer<typeof recordSchema>;

export const dexcomEvgsResp = dexcomResp.merge(
  z.object({
    records: z.array(recordSchema),
  })
);

export type DexcomEvgs = z.infer<typeof dexcomEvgsResp>;
