import { z } from "zod";

export enum WithingsMeasType {
  weight_kg = 1,
  height_m = 4,
  lean_mass_kg = 5,
  body_fat_pct = 6,
  diastolic_mm_Hg = 9,
  systolic_mm_Hg = 10,
  heart_rate_bpm = 11,
  bone_mass_kg = 88,
  temperature = 12,
  spo2 = 54,
  body_temp = 71,
  skin_temp = 73,
  vo2 = 123,
}

export const withingsMeasurementGrp = z.object({
  grpid: z.number(),
  attrib: z.number(),
  date: z.number(),
  created: z.number(),
  modified: z.number(),
  category: z.number(),
  deviceid: z.string().nullable(),
  hash_deviceid: z.string().nullable(),
  measures: z.array(
    z.object({
      value: z.number(),
      type: z.number(),
      unit: z.number(),
    })
  ),
  is_inconclusive: z.boolean().optional().nullable(),
  comment: z.string().optional().nullable(),
  timezone: z.string().optional().nullable(),
});

export type WithingsMeasurementGrp = z.infer<typeof withingsMeasurementGrp>;

// https://developer.withings.com/api-reference/#operation/measure-getmeas
export const withingsMeasurementResp = z.object({
  updatetime: z.number().nullish(),
  timezone: z.string().nullish(),
  measuregrps: z.array(withingsMeasurementGrp),
  more: z.number().nullable().optional(),
  offset: z.number().nullable().optional(),
});

export type WithingsMeasurements = z.infer<typeof withingsMeasurementResp>;
