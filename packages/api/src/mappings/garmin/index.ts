import { MetriportData } from "@metriport/api-sdk/devices/models/metriport-data";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { z } from "zod";
import { TypedData } from "../../command/webhook/devices";
import { ISO_DATE } from "../../shared/date";

dayjs.extend(customParseFormat);

export const garminMetaSchema = z.object({
  userAccessToken: z.string(),
});
export type GarminMeta = z.infer<typeof garminMetaSchema>;

export interface User {
  userAccessToken: string;
}

export interface UserData<T extends MetriportData> {
  user: User;
  typedData: TypedData<T>;
}

export const garminUnits = {
  date: z.string().refine(v => dayjs(v, ISO_DATE, true).isValid()),
  time: z.number().int(),
  timeKey: z.string().transform(v => Number(v)),
  sleep: z.number(),
  kilocalories: z.number(),
  duration: z.number().int(),
  distance: z.number(),
  intensityDuration: z.number().int(),
  floorsClimbed: z.number().int(),
  heartRate: z.number().int(),
  heartRateVariablity: z.number().int(),
  steps: z.number().int(),
  stressLevel: z.number().int(),
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
  massInGrams: z.number().int(),
  percent: z.number(),
  bodyMassIndex: z.number(),
  weightInGrams: z.number().int(),
  vo2: z.number().int(),
  bloodPressure: z.number().int(),
};

export const timeRange = z.object({
  startTimeInSeconds: garminUnits.time,
  endTimeInSeconds: garminUnits.time,
});

export const sleepLevelsSchema = z.object({
  deep: z.array(timeRange).nullish(),
  light: z.array(timeRange).nullish(),
});

export const respirationMeasurements = z.record(garminUnits.timeKey, garminUnits.respiration);
export const spo2Measurements = z.record(garminUnits.timeKey, garminUnits.spo2);

export const garminTypes = {
  date: garminUnits.date,
  duration: garminUnits.duration,
  distance: garminUnits.distance,
  startTime: garminUnits.time,
  measurementTime: garminUnits.time,
  activeTime: garminUnits.time,
  // sleep
  unmeasurableSleep: garminUnits.sleep,
  deepSleepDuration: garminUnits.sleep,
  lightSleepDuration: garminUnits.sleep,
  remSleep: garminUnits.sleep,
  awakeDuration: garminUnits.sleep,
  sleepLevels: sleepLevelsSchema,
  sleepValidation: z.enum([
    "MANUAL",
    "DEVICE",
    "OFF_WRIST",
    "AUTO_TENTATIVE",
    "AUTO_FINAL",
    "AUTO_MANUAL",
    "ENHANCED_TENTATIVE",
    "ENHANCED_FINAL",
  ]),
  timeOffsetSleepRespiration: respirationMeasurements,
  timeOffsetSleepSpo2: spo2Measurements,
  overallSleepScore: z.object({
    value: z.number().nullish(),
    qualifierKey: z.string().nullish(),
  }),
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
  // HRV
  hrv: garminUnits.heartRateVariablity,
  hrvAverage: garminUnits.heartRateVariablity,
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
  //
  muscleMass: garminUnits.massInGrams,
  boneMass: garminUnits.massInGrams,
  bodyWaterInPercent: garminUnits.percent,
  bodyFatInPercent: garminUnits.percent,
  bodyMassIndex: garminUnits.bodyMassIndex,
  weight: garminUnits.weightInGrams,
  //
  vo2Max: garminUnits.vo2,
  // blood pressure
  systolic: garminUnits.bloodPressure,
  diastolic: garminUnits.bloodPressure,
  pulse: garminUnits.heartRate,
  //
  timeOffsetEpochToBreaths: respirationMeasurements,
};
