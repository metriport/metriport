import { z } from "zod";

// https://developer.dexcom.com/docs/dexcomv3/operation/getEstimatedGlucoseValuesV3/
export const recordSchema = z.object({
  recordId: z.string(),
  systemTime: z.string(),
  displayTime: z.string(),
  transmitterId: z.string().nullable().optional(),
  transmitterTicks: z.number(),
  value: z.number().nullable().optional(),
  status: z.string().nullable().optional(),
  trend: z.string().nullable().optional(),
  trendRate: z.number().nullable().optional(),
  unit: z.string(),
  rateUnit: z.string(),
  displayDevice: z.string(),
  transmitterGeneration: z.string(),
});

export type Record = z.infer<typeof recordSchema>;

export const dexcomBiometricsResp = z.object({
  recordType: z.string(),
  recordVersion: z.string(),
  userId: z.string(),
  records: z.array(recordSchema),
});

export type DexcomBiometrics = z.infer<typeof dexcomBiometricsResp>;
