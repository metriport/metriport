import { z } from "zod";

export const patientCohortAssignmentSchema = z.object({
  cohortId: z.string(),
});

export const bulkPatientCohortAssignmentSchema = z.object({
  patientIds: z.array(z.string()),
});

export const bulkPatientCohortRemovalSchema = z
  .object({
    patientIds: z.array(z.string()).optional(),
    all: z.boolean().optional(),
  })
  .refine(data => data.patientIds || data.all, {
    message: "Either patientIds or all must be provided",
  });
