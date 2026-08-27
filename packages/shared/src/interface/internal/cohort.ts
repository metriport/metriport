import z from "zod";
import { COHORT_COLORS } from "../../domain/cohort";
import { patientMonitoringCadenceSchema } from "../../domain/patient/patient-monitoring/utils";

const colorsSchema = z.enum(COHORT_COLORS);

const scheduleSchema = z.object({
  enabled: z.boolean(),
  frequency: patientMonitoringCadenceSchema,
});

const notificationScheduleSchema = z.object({
  notifications: z.boolean(),
  schedule: scheduleSchema,
});

const notificationSchema = z.object({
  notifications: z.boolean(),
});

const adtSchema = z.object({
  enabled: z.boolean(),
});

const monitoringSchema = z.object({
  adt: adtSchema,
  hie: scheduleSchema,
  pharmacy: notificationScheduleSchema,
  laboratory: notificationSchema,
});

const overrideSchema = z.record(z.string(), z.boolean());

const settingsSchema = z.object({
  monitoring: monitoringSchema,
  overrides: overrideSchema,
});

const cohortSchema = z.object({
  id: z.string(),
  eTag: z.string(),
  name: z.string(),
  color: colorsSchema,
  description: z.string(),
  settings: settingsSchema,
  cxId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type InternalCohortResponse = z.infer<typeof cohortSchema>;

export const internalCohortsResponseSchema = z.object({
  cohorts: z.array(cohortSchema),
});

export type InternalCohortsResponse = z.infer<typeof internalCohortsResponseSchema>;

export const internalCohortWithSizeResponseSchema = cohortSchema.extend({
  size: z.number(),
});

export type InternalCohortWithSizeResponse = z.infer<typeof internalCohortWithSizeResponseSchema>;

export const internalCohortsWithSizeResponseSchema = z.object({
  cohorts: z.array(internalCohortWithSizeResponseSchema),
});

export type InternalCohortsWithSizeResponse = z.infer<typeof internalCohortsWithSizeResponseSchema>;

export const internalCohortPatientsResponseSchema = z.object({
  patients: z.array(z.object({ id: z.string() })),
  meta: z.object({
    nextPage: z.string().optional(),
  }),
});

export type InternalCohortPatientsResponse = z.infer<typeof internalCohortPatientsResponseSchema>;
