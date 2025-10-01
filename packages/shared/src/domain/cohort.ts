import { z } from "zod";
import { BaseDomain } from "./base-domain";
import { createQueryMetaSchemaV2 } from "./pagination-v2";
import { BadRequestError } from "../error/bad-request";

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
<<<<<<< HEAD
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
=======
export const cohortColorsSchema = z.enum(COHORT_COLORS);
export const cohortSettingsSchema = z.object({
  adtMonitoring: z.boolean().optional(),
  adtMonitoring_onlyHealthConnectTexas: z.boolean().optional(),
  adtMonitoring_onlyHieTexasPcc: z.boolean().optional(),
  questMonitoring: z.boolean().optional(),
>>>>>>> bb74837308 (feat(core): add hie specific filtering for adt subscribers)
});

export const notificationScheduleSchema = z.object({
  notifications: z.boolean(),
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
    laboratory: notificationScheduleSchema,
  })
  .strict();

export const cohortSettingsSchema = z
  .object({
    monitoring: monitoringSchema,
  })
  .strict();

export const baseCohortSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
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
const allOptionalMonitoringSchema = monitoringSchema.deepPartial();
const allOptionalCohortSettingsSchema = cohortSettingsSchema.deepPartial();

export const cohortUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").optional(),
  color: cohortColorsSchema.optional(),
  description: z.string().optional(),
  settings: allOptionalCohortSettingsSchema.optional(),
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
  color: CohortColors;
  settings: CohortSettings;
};

export type CohortWithSize = Cohort & { size: number };

export type CohortWithSizeDTO = CohortDTO & {
  size: number;
};

export function dtoFromCohort(cohort: Cohort & { eTag: string }): CohortDTO {
  return {
    ...toBaseDTO(cohort),
    name: cohort.name,
    color: cohort.color,
    description: cohort.description,
    settings: cohort.settings ?? DEFAULT_SETTINGS,
  };
}

// ### Query Schemas ###
export const cohortPatientMaxPageSize = 100;

export const cohortPatientListQuerySchema = createQueryMetaSchemaV2(cohortPatientMaxPageSize);
export type CohortPatientListQuery = z.infer<typeof cohortPatientListQuerySchema>;

export function normalizeCohortName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new BadRequestError("Cohort name cannot be empty");
  }
  return trimmed;
}
