import { z } from "zod";

export const patientMappingSchema = z.object({
  cxId: z.string(),
  patientId: z.string(),
  externalId: z.string(),
  source: z.string(),
});

export type PatientMapping = z.infer<typeof patientMappingSchema>;
