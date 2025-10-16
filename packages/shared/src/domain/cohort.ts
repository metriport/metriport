import { z } from "zod";
import { BaseDomain } from "./base-domain";
import { createQueryMetaSchemaV2 } from "./pagination-v2";

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
const DEFAULT_NOTIFICATION_SCHEDULE: NotificationSchedule = {
  notifications: false,
  schedule: "never",
};
const DEFAULT_ADT = false;
const DEFAULT_SCHEDULE: Schedule = "monthly";
const DEFAULT_MONITORING: MonitoringSettings = {
  adt: DEFAULT_ADT,
  hie: DEFAULT_SCHEDULE,
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

export const scheduleSchema = z
  .string()
  .transform(schedule => schedule.toLowerCase().trim())
  .pipe(z.enum(["never", "monthly", "biweekly", "weekly"]));

export type Schedule = z.infer<typeof scheduleSchema>;

export const notificationScheduleSchema = z
  .object({
    notifications: z.boolean().optional(),
    schedule: scheduleSchema.optional(),
  })
  .transform((data, ctx) => {
    if (data.notifications === true) {
      if (data.schedule && data.schedule !== "never") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "When notifications are enabled, schedule must be set to 'never'",
        });
        return z.NEVER;
      }
    }
    return data;
  });

export type NotificationSchedule = z.infer<typeof notificationScheduleSchema>;
export const monitoringSchema = z
  .object({
    adt: z.boolean(),
    hie: scheduleSchema,
    pharmacy: notificationScheduleSchema,
    laboratory: notificationScheduleSchema,
  })
  .strict();
export type MonitoringSettings = z.infer<typeof monitoringSchema>;

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

export type CohortColors = z.infer<typeof cohortColorsSchema>;
export type CohortSettings = z.infer<typeof cohortSettingsSchema>;
export type BaseCohort = z.infer<typeof baseCohortSchema>;
// #########################

// ### Input Interfaces ###
// > Request schemas for parsing request body

// > Create Schemas
const monitoringSchemaWithDefaults = z.object({
  adt: z.boolean().optional().default(DEFAULT_ADT),
  hie: scheduleSchema.default(DEFAULT_MONITORING.hie),
  pharmacy: notificationScheduleSchema.default(DEFAULT_MONITORING.pharmacy),
  laboratory: notificationScheduleSchema.default(DEFAULT_MONITORING.laboratory),
});

const settingsSchemaWithDefaults = z.object({
  monitoring: monitoringSchemaWithDefaults.optional().default(DEFAULT_MONITORING),
});

export const cohortCreateSchema = baseCohortSchema.extend({
  description: z.string().optional(),
  color: cohortColorsSchema.optional().default(DEFAULT_COLOR),
  settings: settingsSchemaWithDefaults.optional().default(DEFAULT_SETTINGS),
});

// > Update Schemas
const monitoringSchemaPartial = z
  .object({
    adt: z.boolean().optional(),
    hie: scheduleSchema.optional(),
    pharmacy: notificationScheduleSchema.optional(),
    laboratory: notificationScheduleSchema.optional(),
  })
  .strict();

const cohortSettingsPartialSchema = z
  .object({
    monitoring: monitoringSchemaPartial.optional(),
  })
  .strict();

export type CohortSettingsPartial = z.infer<typeof cohortSettingsPartialSchema>;
export type CohortMonitoringPartial = z.infer<typeof monitoringSchemaPartial>;

export const cohortUpdateSchema = z.object({
  name: z
    .string()
    .transform(name => normalizeCohortName(name))
    .optional(),
  color: cohortColorsSchema.optional(),
  description: z.string().optional(),
  settings: cohortSettingsPartialSchema,
  eTag: z.string().optional(),
});

export type CohortCreateRequest = z.infer<typeof cohortCreateSchema>;
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
