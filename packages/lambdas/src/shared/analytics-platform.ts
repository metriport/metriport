import { z } from "zod";

export const fhirToCsvSchema = z.object({
  cxId: z.string(),
  jobId: z.string(),
  patientId: z.string(),
  inputBundle: z.string().optional(),
});
