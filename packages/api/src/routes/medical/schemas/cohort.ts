import { z } from "zod";

export const monitoringSchema = z.object({
  adt: z.boolean().optional(),
});

export const cohortCreateSchema = z.object({
  name: z.string(),
  monitoring: monitoringSchema.optional(),
});

export const cohortUpdateSchema = cohortCreateSchema;

export const patientAssignmentSchema = z.object({
  cohortId: z.string(),
});

export const bulkPatientAssignmentSchema = z.object({
  patientIds: z.array(z.string()),
});

export const bulkPatientRemovalSchema = z
  .object({
    patientIds: z.array(z.string()).optional(),
    all: z.boolean().optional(),
  })
  .refine(data => data.patientIds || data.all, {
    message: "Either patientIds or all must be provided",
  });
