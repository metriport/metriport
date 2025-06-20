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
  })
  .refine(data => !data.patientIds || data.patientIds.length > 0, {
    message: "patientIds must be an array of patient IDs",
  })
  .refine(data => !(data.patientIds && data.all), {
    message: "patientIds and all cannot be provided together",
  });
