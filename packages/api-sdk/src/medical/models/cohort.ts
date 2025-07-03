import { z } from "zod";
import { baseUpdateSchema } from "./common/base-update";

export const cohortMonitoringSchema = z.object({
  adt: z.boolean(),
});

export const cohortCreateSchema = z.object({
  name: z.string(),
  monitoring: cohortMonitoringSchema,
});

export const cohortUpdateSchema = z
  .object({
    name: z.string(),
    monitoring: cohortMonitoringSchema.optional(),
  })
  .merge(baseUpdateSchema);

export const cohortDTOSchema = cohortCreateSchema.merge(
  z.object({
    id: z.string().uuid(),
    dateCreated: z.string().datetime().optional(),
  })
);

export const cohortWithCountDTOSchema = z.object({
  cohort: cohortDTOSchema,
  patientCount: z.number(),
});

export const cohortWithPatientIdsAndCountDTOSchema = cohortWithCountDTOSchema.merge(
  z.object({
    patientIds: z.array(z.string()),
  })
);

export const cohortListResponseSchema = z.object({
  cohorts: z.array(cohortWithCountDTOSchema),
});

export const patientUnassignmentResponseSchema = z.object({
  message: z.string(),
  unassignedCount: z.number(),
});

export const cohortSchema = cohortCreateSchema.merge(baseUpdateSchema);

export const cohortPatientIdsSchema = z.object({
  patientIds: z.array(z.string()),
});

export type CohortCreate = z.infer<typeof cohortCreateSchema>;
export type Cohort = z.infer<typeof cohortSchema>;
export type CohortUpdate = z.infer<typeof cohortUpdateSchema>;
export type CohortDTO = z.infer<typeof cohortDTOSchema>;
export type CohortWithCountDTO = z.infer<typeof cohortWithCountDTOSchema>;
export type CohortWithPatientIdsAndCountDTO = z.infer<typeof cohortWithPatientIdsAndCountDTOSchema>;
export type CohortListResponse = z.infer<typeof cohortListResponseSchema>;
export type CohortPatientIds = z.infer<typeof cohortPatientIdsSchema>;
export type PatientAssignmentRequest = {
  patientIds?: string[];
  all?: boolean;
};

export type PatientUnassignmentResponse = z.infer<typeof patientUnassignmentResponseSchema>;
