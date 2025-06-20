import { z } from "zod";

export const patientCohortAssignmentSchema = z.object({
  cohortId: z.string(),
});

export const bulkPatientCohortSchema = z
  .object({
    patientIds: z.array(z.string()).optional(),
    all: z.boolean().optional(),
  })
  .refine(data => data.patientIds || data.all, {
    message: "Either patientIds or all must be provided",
  });
