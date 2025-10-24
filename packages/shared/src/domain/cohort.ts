import { z } from "zod";
import { BaseDomain } from "./base-domain";
import { createQueryMetaSchemaV2 } from "./pagination-v2";
import { USState } from "./address/state";

// ### Constants ###
export const COHORT_COLORS = [
  "red",
  "green",
  "blue",
  "yellow",
  "purple",
  "orange",
  "pink",
  "brown",
  "gray",
  "black",
  "white",
] as const;

// ### Default Values ###
export const DEFAULT_COLOR = "white";

export const DEFAULT_FREQUENCY = "monthly";
export const DEFAULT_SCHEDULE: Schedule = {
  enabled: false,
  frequency: DEFAULT_FREQUENCY,
};

export const DEFAULT_SCHEDULE_HIE: Schedule = {
  enabled: true, // Docs say HIE is enabled by default.
  frequency: DEFAULT_FREQUENCY,
};

export const DEFAULT_NOTIFICATION_SCHEDULE: NotificationSchedule = {
  notifications: false,
  schedule: DEFAULT_SCHEDULE,
};

const DEFAULT_ADT: AdtSchema = {
  enabled: false,
  overrides: [],
};

const DEFAULT_MONITORING: MonitoringSettings = {
  adt: DEFAULT_ADT,
  hie: DEFAULT_SCHEDULE_HIE,
  pharmacy: DEFAULT_NOTIFICATION_SCHEDULE,
  laboratory: DEFAULT_NOTIFICATION_SCHEDULE,
};

export const DEFAULT_SETTINGS: CohortSettings = {
  monitoring: DEFAULT_MONITORING,
};

// ### Domain Interface ###
export const cohortColorsSchema = z
  .string()
  .transform(color => color.toLowerCase().trim())
  .pipe(z.enum(COHORT_COLORS));

export const frequencySchema = z
  .string()
  .transform(frequency => frequency.toLowerCase().trim())
  .pipe(z.enum(["monthly", "biweekly", "weekly"]));

export const scheduleSchema = z.object({
  enabled: z.boolean(),
  frequency: frequencySchema,
});

export const notificationScheduleSchema = z.object({
  notifications: z.boolean(),
  schedule: scheduleSchema,
});

const adtOverrideSchema = z.array(
  z.string().refine(
    s => {
      const parts = s.split("_");
      if (parts.length !== 2) return false;
      const [, stateCode] = parts;
      return Object.values(USState).includes(stateCode as USState);
    },
    {
      message:
        "Invalid ADT override format. Must be 'HieName_STATE' where STATE is a valid 2-letter state code. Example: Bamboo_CA",
    }
  )
);

const adtSchema = z.object({
  enabled: z.boolean(),
  overrides: adtOverrideSchema,
});

export const monitoringSchema = z
  .object({
    adt: adtSchema,
    hie: scheduleSchema,
    pharmacy: notificationScheduleSchema,
    laboratory: notificationScheduleSchema,
  })
  .strict();

export const cohortSettingsSchema = z
  .object({
    monitoring: monitoringSchema,
  })
  .strict();

export const baseCohortSchema = z.object({
  name: z.string().transform(name => normalizeCohortName(name)),
  color: cohortColorsSchema,
  description: z.string(),
  settings: cohortSettingsSchema,
});

export type NotificationSchedule = z.infer<typeof notificationScheduleSchema>;
export type CohortFrequency = z.infer<typeof frequencySchema>;
export type MonitoringSettings = z.infer<typeof monitoringSchema>;
export type Schedule = z.infer<typeof scheduleSchema>;
export type CohortColors = z.infer<typeof cohortColorsSchema>;
export type CohortSettings = z.infer<typeof cohortSettingsSchema>;
export type BaseCohort = z.infer<typeof baseCohortSchema>;

// Frequency priority mapping for merging (lower number = more frequent)
export const FREQUENCY_PRIORITY: Record<CohortFrequency, number> = {
  weekly: 1,
  biweekly: 2,
  monthly: 3,
};

// > Create Schemas
// Want to use default values for create schema, but not for update schema so that we don't overwrite existing settings
const monitoringSchemaWithDefaults = z.object({
  adt: adtSchema.default(DEFAULT_MONITORING.adt),
  hie: scheduleSchema.default(DEFAULT_MONITORING.hie),
  pharmacy: notificationScheduleSchema.default(DEFAULT_MONITORING.pharmacy),
  laboratory: notificationScheduleSchema.default(DEFAULT_MONITORING.laboratory),
});

const settingsSchemaWithDefaults = z.object({
  monitoring: monitoringSchemaWithDefaults.optional().default(DEFAULT_MONITORING),
});

export const cohortCreateSchema = baseCohortSchema.extend({
  description: z.string().optional().default(""),
  color: cohortColorsSchema.optional().default(DEFAULT_COLOR),
  settings: settingsSchemaWithDefaults.optional().default(DEFAULT_SETTINGS),
});

export type CohortCreateInput = z.input<typeof cohortCreateSchema>;

// > Update Schemas
const allOptionalScheduleSchema = z.object({
  enabled: z.boolean().optional(),
  frequency: frequencySchema.optional(),
});

const allOptionalNotificationScheduleSchema = z.object({
  notifications: z.boolean().optional(),
  schedule: allOptionalScheduleSchema.optional(),
});

const allOptionalMonitoringSchema = z
  .object({
    adt: adtSchema.optional(),
    hie: allOptionalScheduleSchema.optional(),
    pharmacy: allOptionalNotificationScheduleSchema.optional(),
    laboratory: allOptionalNotificationScheduleSchema.optional(),
  })
  .strict();

const allOptionalCohortSettingsSchema = z
  .object({
    monitoring: allOptionalMonitoringSchema.optional(),
  })
  .strict();

export const cohortUpdateSchema = z.object({
  name: z
    .string()
    .transform(name => normalizeCohortName(name))
    .optional(),
  color: cohortColorsSchema.optional(),
  description: z.string().optional(),
  settings: allOptionalCohortSettingsSchema,
  eTag: z.string().optional(),
});

export type AdtSchema = z.infer<typeof adtSchema>;
export type AllOptionalMonitoringSchema = z.infer<typeof allOptionalMonitoringSchema>;
export type AllOptionalCohortSettings = z.infer<typeof allOptionalCohortSettingsSchema>;
export type CohortUpdateRequest = z.infer<typeof cohortUpdateSchema>;

// > Command schemas after parsing request body
export type CohortCreateCmd = z.infer<typeof cohortCreateSchema> & { cxId: string };
export type CohortUpdateCmd = z.infer<typeof cohortUpdateSchema> & { id: string; cxId: string };
// #########################

// ### Output Interfaces ###
export type Cohort = BaseCohort & BaseDomain & { cxId: string };
// #########################

// Move this somewhere else?
export type BaseDTO = {
  id: string;
  eTag: string;
};

export function toBaseDTO(model: { id: string; eTag: string }): BaseDTO {
  return {
    id: model.id,
    eTag: model.eTag,
  };
}

export type CohortDTO = BaseDTO & {
  name: string;
  description: string;
  settings: CohortSettings;
};

export type CohortWithSize = {
  cohort: Cohort;
  size: number;
};

export type CohortWithSizeDTO = {
  cohort: CohortDTO;
  size: number;
};

export function dtoFromCohort(cohort: Cohort & { eTag: string }): CohortDTO {
  return {
    ...toBaseDTO(cohort),
    name: cohort.name,
    description: cohort.description,
    settings: cohort.settings || DEFAULT_SETTINGS,
  };
}

// ### Query Schemas ###
export const cohortPatientMaxPageSize = 100;

export const cohortPatientListQuerySchema = createQueryMetaSchemaV2(cohortPatientMaxPageSize);
export type CohortPatientListQuery = z.infer<typeof cohortPatientListQuerySchema>;

export function normalizeCohortName(name: string): string {
  return name.trim();
}
