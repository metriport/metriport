import { MetriportData } from "@metriport/api/lib/models/metriport-data";
import dayjs from "dayjs";
import { z } from "zod";

export const ISO_DATE = "YYYY-MM-DD";

export const garminMetaSchema = z.object({
  userAccessToken: z.string(),
});
export type GarminMeta = z.infer<typeof garminMetaSchema>;

export interface User {
  userAccessToken: string;
}

// TODO move out of Garmin for reuse across Providers
export type DataType = "activity" | "sleep";

// TODO move out of Garmin for reuse across Providers
export interface TypedData<T extends MetriportData> {
  type: DataType;
  data: T;
}
// TODO move out of Garmin for reuse across Providers
export interface UserData<T extends MetriportData> {
  user: User;
  typedData: TypedData<T>;
}

export const toISODate = (unixTime: number): string => {
  return dayjs.unix(unixTime).format(ISO_DATE);
};

export const toISODateTime = (unixTime: number): string => {
  return dayjs.unix(unixTime).toISOString();
};

export const oneOf = <T>(...values: T[]): NonNullable<T> | undefined =>
  values.find((v) => v != null) ?? undefined;

/**
 * Converts the parameter to undefined if its null, or return
 * it if present.
 * The return type is the original or undefined, can't return null.
 */
export const optional = <T>(v: T): NonNullable<T> | undefined =>
  v != null ? v : undefined;

export const garminUnits = {
  date: z.string().optional().nullable(), // or regex('yyyy-mm-dd')
  time: z.number().int(),
  timeKey: z.string().transform((v) => Number(v)),
  sleep: z.number().nullable().optional(),
  kilocalories: z.number().nullable().optional(),
  duration: z.number().int().nullable().optional(),
  distance: z.number().int().nullable().optional(),
  intensityDuration: z.number().int().nullable().optional(),
  floorsClimbed: z.number().int().nullable().optional(),
  heartRate: z.number().int().nullable().optional(),
  steps: z.number().int().nullable().optional(),
  stressLevel: z.number().int().nullable().optional(),
  stressQualifier: z.enum([
    "unknown",
    "calm",
    "balanced",
    "stressful",
    "very_stressful",
    "calm_awake",
    "balanced_awake",
    "stressful_awake",
    "very_stressful_awake",
  ]),
  respiration: z.number(),
  spo2: z.number(),
  sleepScore: z.enum(["EXCELLENT", "GOOD", "FAIR", "POOR"]),
};

export const timeRange = z
  .object({
    startTimeInSeconds: garminUnits.time,
    endTimeInSeconds: garminUnits.time,
  })
  .nullable()
  .optional();

export const sleepLevelsSchema = z.object({
  deep: z.array(timeRange),
  light: z.array(timeRange),
});

export const respirationMeasurements = z.map(
  z.number().int(),
  garminUnits.respiration
);
export const spo2Measurements = z.record(garminUnits.timeKey, garminUnits.spo2);

export const garminTypes = {
  date: garminUnits.date,
  duration: garminUnits.duration,
  distance: garminUnits.distance,
  startTime: garminUnits.time,
  activeTime: garminUnits.time,
  // sleep
  unmeasurableSleep: garminUnits.sleep,
  deepSleepDuration: garminUnits.sleep,
  lightSleepDuration: garminUnits.sleep,
  remSleep: garminUnits.sleep,
  awakeDuration: garminUnits.sleep,
  sleepLevels: sleepLevelsSchema.nullable().optional(),
  sleepValidation: z
    .enum([
      "MANUAL",
      "DEVICE",
      "OFF_WRIST",
      "AUTO_TENTATIVE",
      "AUTO_FINAL",
      "AUTO_MANUAL",
      "ENHANCED_TENTATIVE",
      "ENHANCED_FINAL",
    ])
    .nullable()
    .optional(),
  timeOffsetSleepRespiration: respirationMeasurements.nullable().optional(),
  timeOffsetSleepSpo2: spo2Measurements.nullable().optional(),
  overallSleepScore: z
    .object({
      value: z.number(),
      qualifierKey: z.string(),
    })
    .nullable()
    .optional(),
  //
  activeKilocalories: garminUnits.kilocalories,
  bmrKilocalories: garminUnits.kilocalories,
  //
  moderateIntensityDuration: garminUnits.intensityDuration,
  vigorousIntensityDuration: garminUnits.intensityDuration,
  intensityDurationGoal: garminUnits.intensityDuration,
  //
  floorsClimbed: garminUnits.floorsClimbed,
  floorsClimbedGoal: garminUnits.floorsClimbed,
  // heart rate
  minHeartRate: garminUnits.heartRate,
  averageHeartRate: garminUnits.heartRate,
  maxHeartRate: garminUnits.heartRate,
  restingHeartRate: garminUnits.heartRate,
  timeOffsetHeartRateSamples: garminUnits.heartRate,
  // stress
  averageStressLevel: garminUnits.stressLevel,
  maxStressLevel: garminUnits.stressLevel,
  stressDuration: garminUnits.duration,
  restStressDuration: garminUnits.duration,
  activityStressDuration: garminUnits.duration,
  lowStressDuration: garminUnits.duration,
  mediumStressDuration: garminUnits.duration,
  highStressDuration: garminUnits.duration,
  stressQualifier: garminUnits.stressQualifier,
  //
  steps: garminUnits.steps,
  stepsGoal: garminUnits.steps,
};
