import { z } from "zod";

export const labOrderObservationResultSchema = z.object({
  id: z.string(),
  units: z.string(),
  quantitative_result: z.string(),
  reference_range: z.string(),
  interpretation: z.enum(["NORMAL", "ABNORMAL", "CRITICAL", "UNKNOWN"]),
  notes: z.string().nullable(),
});
export type LabOrderObservationResult = z.infer<typeof labOrderObservationResultSchema>;

export const labOrderObservationRequestSchema = z.object({
  id: z.string(),
  lab_analyte: z.string(),
  lab_observation_results: labOrderObservationResultSchema.array(),
});
export type LabOrderObservationRequest = z.infer<typeof labOrderObservationRequestSchema>;

export const labResultSchema = z.object({
  id: z.string(),
  lab_observation_requests: labOrderObservationRequestSchema.array(),
});
export type LabResult = z.infer<typeof labResultSchema>;

export const labOrderSchema = z.object({
  id: z.string(),
  status: z.string(),
  normalized_status: z.string(),
  test_date: z.string(),
  lab_results: labResultSchema.array(),
});
export type LabOrder = z.infer<typeof labOrderSchema>;

export const labOrdersGraphqlSchema = z.object({
  data: z.object({
    labOrders: labOrderSchema.array(),
  }),
});
export type LabOrdersGraphql = z.infer<typeof labOrdersGraphqlSchema>;
