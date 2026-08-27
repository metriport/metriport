import {
  COHORT_COLORS,
  cohortPatientMaxPageSize,
  DEFAULT_COLOR,
  DEFAULT_FREQUENCY,
  DEFAULT_MONITORING,
  DEFAULT_NOTIFICATION,
  DEFAULT_NOTIFICATION_SCHEDULE,
  DEFAULT_SCHEDULE,
  DEFAULT_SETTINGS,
} from "@metriport/shared/domain/cohort";
import { createQueryMetaSchemaV2 } from "@metriport/shared/domain/pagination-v2";
import { PATIENT_MONITORING_CADENCES } from "@metriport/shared/domain/patient/patient-monitoring/utils";
import { cloneDeep } from "lodash";
import { z } from "zod";

export const cohortColorsSchema = z
  .string()
  .transform(color => color.toLowerCase().trim())
  .pipe(z.enum(COHORT_COLORS));

export const frequencySchema = z
  .string()
  .transform(frequency => frequency.toLowerCase().trim())
  .pipe(z.enum(PATIENT_MONITORING_CADENCES));

export const scheduleSchema = z.object({
  enabled: z.boolean(),
  frequency: frequencySchema,
});

const notificationSchema = z.object({
  notifications: z.boolean(),
});

export const notificationScheduleSchema = notificationSchema.extend({
  schedule: scheduleSchema,
});

const adtSchema = z.object({
  enabled: z.boolean(),
});

export const monitoringSchema = z
  .object({
    adt: adtSchema,
    hie: scheduleSchema,
    pharmacy: notificationScheduleSchema,
    laboratory: notificationSchema,
  })
  .strict();

const overridesSchema = z.record(z.string(), z.boolean()).optional();

export const settingsSchema = z
  .object({
    monitoring: monitoringSchema,
    overrides: overridesSchema,
  })
  .strict();

const allOptionalSettingsSchema = settingsSchema.deepPartial();

// > Create Schemas
// Want to use default values for create schema, but not for update schema so that we don't overwrite existing settings
const scheduleSchemaWithDefaults = z
  .object({
    enabled: z.boolean().optional().default(false),
    frequency: frequencySchema.optional().default(DEFAULT_FREQUENCY),
  })
  .default(() => cloneDeep(DEFAULT_SCHEDULE));

const notificationScheduleSchemaWithDefaults = z
  .object({
    notifications: z.boolean().optional().default(false),
    schedule: scheduleSchemaWithDefaults.optional().default(() => cloneDeep(DEFAULT_SCHEDULE)),
  })
  .default(() => cloneDeep(DEFAULT_NOTIFICATION_SCHEDULE));

const adtSchemaWithDefaults = z
  .object({
    enabled: z.boolean().optional().default(false),
  })
  .default(() => cloneDeep(DEFAULT_MONITORING.adt));

const notificationSchemaWithDefaults = z
  .object({
    notifications: z.boolean().optional().default(false),
  })
  .default(() => cloneDeep(DEFAULT_NOTIFICATION));

const monitoringSchemaWithDefaults = z
  .object({
    adt: adtSchemaWithDefaults.optional().default(() => cloneDeep(DEFAULT_MONITORING.adt)),
    hie: scheduleSchemaWithDefaults.optional().default(() => cloneDeep(DEFAULT_SCHEDULE)),
    pharmacy: notificationScheduleSchemaWithDefaults
      .optional()
      .default(() => cloneDeep(DEFAULT_MONITORING.pharmacy)),
    laboratory: notificationSchemaWithDefaults
      .optional()
      .default(() => cloneDeep(DEFAULT_MONITORING.laboratory)),
  })
  .strict();

const settingsSchemaWithDefaults = z
  .object({
    monitoring: monitoringSchemaWithDefaults
      .optional()
      .default(() => cloneDeep(DEFAULT_MONITORING)),
    overrides: overridesSchema.optional().default({}),
  })
  .strict();

export const cohortCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  color: cohortColorsSchema.optional().default(DEFAULT_COLOR),
  description: z.string().optional().default(""),
  settings: settingsSchemaWithDefaults.optional().default(() => cloneDeep(DEFAULT_SETTINGS)),
});

export const cohortUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").optional(),
    color: cohortColorsSchema.optional(),
    description: z.string().optional(),
    settings: allOptionalSettingsSchema.optional(),
    eTag: z.string().optional(),
  })
  .strict();

export const cohortUpdateSchemaWithoutSettings = cohortUpdateSchema.omit({ settings: true });

export const cohortPatientListQuerySchema = createQueryMetaSchemaV2(cohortPatientMaxPageSize);

export const cohortIdsSchema = z.object({ cohortIds: z.array(z.string()).nonempty() });
