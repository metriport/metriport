import { z } from "zod";

export const labOrderObservationResultSchema = z.object({
  id: z.string(),
  interpretation: z.enum(["NORMAL", "ABNORMAL", "CRITICAL", "UNKNOWN"]),
  units: z.string().nullable(),
  quantitative_result: z.string().nullable(),
  reference_range: z.string().nullable(),
  notes: z.string().nullable(),
});
export type LabOrderObservationResult = z.infer<typeof labOrderObservationResultSchema>;

export const labOrderObservationRequestSchema = z.object({
  id: z.string(),
  lab_analyte: z.string().nullable(),
  lab_observation_results: labOrderObservationResultSchema.array(),
});
export type LabOrderObservationRequest = z.infer<typeof labOrderObservationRequestSchema>;

export const labResultSchema = z.object({
  id: z.string(),
  lab_observation_requests: labOrderObservationRequestSchema.array().nullable(),
});
export type LabResult = z.infer<typeof labResultSchema>;

export const labOrderSchema = z.object({
  id: z.string(),
  status: z.string().nullable(),
  test_date: z.string().nullable(),
  lab_results: labResultSchema.array(),
});
export type LabOrder = z.infer<typeof labOrderSchema>;

export const labOrdersGraphqlSchema = z.object({
  data: z.object({
    labOrders: labOrderSchema.array(),
  }),
});
export type LabOrdersGraphql = z.infer<typeof labOrdersGraphqlSchema>;
