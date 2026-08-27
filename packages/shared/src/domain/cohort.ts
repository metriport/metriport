import { cloneDeep } from "lodash";
import { DeepPartial } from "../common/merge-settings";
import { BadRequestError } from "../error/bad-request";
import { BaseDomain } from "./base-domain";
import { BaseDTO, toBaseDTO } from "./baseDto";
import { PatientMonitoringCadence } from "./patient/patient-monitoring/utils";

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
export const STATE_VALIDATION_OVERRIDE_KEY = "Filter_By_Patient_State";

export const DEFAULT_COLOR = "white";
export const DEFAULT_FREQUENCY = PatientMonitoringCadence.MONTHLY;

export const DEFAULT_SCHEDULE: Schedule = {
  enabled: false,
  frequency: DEFAULT_FREQUENCY,
};

export const DEFAULT_NOTIFICATION: Notification = {
  notifications: false,
};

export const DEFAULT_NOTIFICATION_SCHEDULE: NotificationSchedule = {
  ...DEFAULT_NOTIFICATION,
  schedule: DEFAULT_SCHEDULE,
};

const DEFAULT_ADT: AdtSchema = {
  enabled: false,
};

export const DEFAULT_MONITORING: MonitoringSettings = {
  adt: cloneDeep(DEFAULT_ADT),
  hie: cloneDeep(DEFAULT_SCHEDULE),
  pharmacy: cloneDeep(DEFAULT_NOTIFICATION_SCHEDULE),
  laboratory: cloneDeep(DEFAULT_NOTIFICATION),
};

export const DEFAULT_OVERRIDES: Overrides = {};

export const DEFAULT_SETTINGS: Settings = {
  monitoring: DEFAULT_MONITORING,
  overrides: DEFAULT_OVERRIDES,
};

// ### Domain Types ###
export type CohortColors = (typeof COHORT_COLORS)[number];

export type Schedule = {
  enabled: boolean;
  frequency: PatientMonitoringCadence;
};

export type NotificationSchedule = {
  notifications: boolean;
  schedule: Schedule;
};

type Notification = {
  notifications: boolean;
};

export type AdtSchema = {
  enabled: boolean;
};

export type MonitoringSettings = {
  adt: AdtSchema;
  hie: Schedule;
  pharmacy: NotificationSchedule;
  laboratory: Notification;
};

export type AllOptionalMonitoringSettings = DeepPartial<MonitoringSettings>;

// Should only be used internally
export type Overrides = Record<string, boolean> | undefined;

export type Settings = {
  monitoring: MonitoringSettings;
  overrides: Overrides;
};

export type SettingsWithoutOverrides = {
  monitoring: MonitoringSettings;
};

export type AllOptionalSettings = DeepPartial<Settings>;
export type AllOptionalSettingsWithoutOverrides = DeepPartial<SettingsWithoutOverrides>;

export type Cohort = BaseDomain & {
  name: string;
  color: CohortColors;
  description: string;
  settings: Settings;
  cxId: string;
};

export type CohortWithSize = Cohort & { size: number };

export type CohortCreateCmd = Pick<Cohort, "name"> &
  Partial<Pick<Cohort, "description" | "color" | "settings">> & { cxId: string };

export type CohortUpdateCmd = Partial<Pick<Cohort, "name" | "description" | "color">> & {
  id: string;
  cxId: string;
  eTag?: string;
  settings?: AllOptionalSettings;
};

export type CohortUpdateRequestWithoutSettings = Omit<CohortUpdateCmd, "cxId" | "settings">;

export type CohortResponse = BaseDTO & {
  name: string;
  description: string;
  color: CohortColors;
  settings: Settings;
};

export type CohortResponseWithoutOverrides = Omit<CohortResponse, "settings"> & {
  settings: SettingsWithoutOverrides;
};

export type CohortWithSizeResponse = CohortResponse & {
  size: number;
};

export type CohortWithSizeResponseWithoutOverrides = Omit<CohortWithSizeResponse, "settings"> & {
  settings: SettingsWithoutOverrides;
};

export function responseDtoFromCohort(cohort: Cohort): CohortResponseWithoutOverrides {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { overrides: _removedOverrides, ...settingsWithoutOverrides } = cohort.settings;

  return {
    ...toBaseDTO({ id: cohort.id, eTag: cohort.eTag }),
    name: cohort.name,
    color: cohort.color,
    description: cohort.description,
    settings: settingsWithoutOverrides,
  };
}
// ### Query Constants ###
export const cohortPatientMaxPageSize = 100;

export function normalizeCohortName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new BadRequestError("Cohort name cannot be empty");
  }
  return trimmed;
}

export function isScheduleMonitoringActive(cohort: Cohort): boolean {
  return (
    cohort.settings.monitoring.hie.enabled || cohort.settings.monitoring.pharmacy.schedule.enabled
  );
}
