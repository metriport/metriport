import { z } from "zod";

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
  updatetime: z.number(),
  timezone: z.string(),
  measuregrps: z.array(withingsMeasurementGrp),
  more: z.number().nullable().optional(),
  offset: z.number().nullable().optional(),
});

export type WithingsMeasurements = z.infer<typeof withingsMeasurementResp>;
