import { z } from "zod";

export const monitoringSchema = z.object({
  adt: z.boolean().optional(),
});

export const cohortCreateSchema = z.object({
  name: z.string(),
  monitoring: monitoringSchema.optional(),
});

export const cohortUpdateSchema = cohortCreateSchema;
