import { z } from "zod";
import { Activity, Body, Biometrics, Nutrition, Sleep } from "@metriport/api-sdk";
import { Metadata } from "@metriport/api-sdk/devices/models/common/metadata";
import dayjs from "dayjs";

import { ISO_DATE } from "../../shared/date";
import { mapDataToActivity } from "./activity";
import { mapDataToBody } from "./body";
import { mapDataToBiometrics } from "./biometrics";
import { mapDataToNutrition } from "./nutrition";
import { mapDataToSleep } from "./sleep";
import { PROVIDER_APPLE } from "../../shared/constants";

export type AppleWebhookPayload = {
  activity?: Activity[];
  body?: Body[];
  biometrics?: Biometrics[];
  nutrition?: Nutrition[];
  sleep?: Sleep[];
};

export function mapData(data: AppleHealth, hourly: boolean): AppleWebhookPayload {
  const payload: AppleWebhookPayload = {};

  const activityData = mapDataToActivity(data, hourly);

  if (activityData.length) payload.activity = activityData;

  const bodyData = mapDataToBody(data, hourly);

  if (bodyData.length) payload.body = bodyData;

  const biometricsData = mapDataToBiometrics(data, hourly);

  if (biometricsData.length) payload.biometrics = biometricsData;

  const nutritionData = mapDataToNutrition(data, hourly);

  if (nutritionData.length) payload.nutrition = nutritionData;

  const sleepData = mapDataToSleep(data, hourly);

  if (sleepData.length) payload.sleep = sleepData;

  return payload;
}

export const createMetadata = (
  date: string,
  hourly: boolean,
  sourceName?: string | null,
  sourceId?: string | null
): Metadata => {
  return {
    date: dayjs(date).format(ISO_DATE),
    ...(hourly ? { hour: dayjs(date).format("HH:mm") } : undefined),
    source: PROVIDER_APPLE,
    ...(sourceName || sourceId
      ? {
          data_source: {
            ...(sourceName ? { name: sourceName } : undefined),
            ...(sourceId ? { id: sourceId } : undefined),
          },
        }
      : undefined),
  };
};

export const hasActivity = (data: AppleHealth): boolean => {
  return (
    !!data.HKQuantityTypeIdentifierActiveEnergyBurned ||
    !!data.HKQuantityTypeIdentifierStepCount ||
    !!data.HKQuantityTypeIdentifierActiveEnergyBurned ||
    !!data.HKQuantityTypeIdentifierBasalEnergyBurned ||
    !!data.HKQuantityTypeIdentifierFlightsClimbed
  );
};

export const hasBody = (data: AppleHealth): boolean => {
  return (
    !!data.HKQuantityTypeIdentifierHeight ||
    !!data.HKQuantityTypeIdentifierLeanBodyMass ||
    !!data.HKQuantityTypeIdentifierBodyMass ||
    !!data.HKQuantityTypeIdentifierBodyFatPercentage
  );
};

export const hasNutrition = (data: AppleHealth): boolean => {
  return (
    !!data.HKQuantityTypeIdentifierDietaryCaffeine ||
    !!data.HKQuantityTypeIdentifierDietaryCalcium ||
    !!data.HKQuantityTypeIdentifierDietaryCarbohydrates ||
    !!data.HKQuantityTypeIdentifierDietaryCholesterol ||
    !!data.HKQuantityTypeIdentifierDietaryCopper ||
    !!data.HKQuantityTypeIdentifierDietaryEnergyConsumed ||
    !!data.HKQuantityTypeIdentifierDietaryFatTotal ||
    !!data.HKQuantityTypeIdentifierDietaryFiber ||
    !!data.HKQuantityTypeIdentifierDietaryFolate ||
    !!data.HKQuantityTypeIdentifierDietaryIodine ||
    !!data.HKQuantityTypeIdentifierDietaryMagnesium ||
    !!data.HKQuantityTypeIdentifierDietaryManganese ||
    !!data.HKQuantityTypeIdentifierDietaryNiacin ||
    !!data.HKQuantityTypeIdentifierDietaryPantothenicAcid ||
    !!data.HKQuantityTypeIdentifierDietaryPhosphorus ||
    !!data.HKQuantityTypeIdentifierDietaryPotassium ||
    !!data.HKQuantityTypeIdentifierDietaryProtein ||
    !!data.HKQuantityTypeIdentifierDietaryRiboflavin ||
    !!data.HKQuantityTypeIdentifierDietarySelenium ||
    !!data.HKQuantityTypeIdentifierDietarySodium ||
    !!data.HKQuantityTypeIdentifierDietarySugar ||
    !!data.HKQuantityTypeIdentifierDietaryThiamin ||
    !!data.HKQuantityTypeIdentifierDietaryVitaminA ||
    !!data.HKQuantityTypeIdentifierDietaryVitaminB6 ||
    !!data.HKQuantityTypeIdentifierDietaryVitaminB12 ||
    !!data.HKQuantityTypeIdentifierDietaryVitaminC ||
    !!data.HKQuantityTypeIdentifierDietaryVitaminD ||
    !!data.HKQuantityTypeIdentifierDietaryVitaminE ||
    !!data.HKQuantityTypeIdentifierDietaryVitaminK ||
    !!data.HKQuantityTypeIdentifierDietaryWater ||
    !!data.HKQuantityTypeIdentifierDietaryZinc
  );
};

export const hasBiometrics = (data: AppleHealth): boolean => {
  return (
    !!data.HKQuantityTypeIdentifierHeartRate ||
    !!data.HKQuantityTypeIdentifierRestingHeartRate ||
    !!data.HKQuantityTypeIdentifierHeartRateVariabilitySDNN ||
    !!data.HKQuantityTypeIdentifierBodyTemperature ||
    !!data.HKQuantityTypeIdentifierBloodPressureSystolic ||
    !!data.HKQuantityTypeIdentifierBloodPressureDiastolic ||
    !!data.HKQuantityTypeIdentifierRespiratoryRate
  );
};

export const appleItem = z.object({
  date: z.string(),
  value: z.number(),
});
export type AppleHealthItem = z.infer<typeof appleItem>;

export enum SleepType {
  inBed = "inBed",
  awake = "awake",
  rem = "rem",
  core = "core",
  deep = "deep",
}

export const appleSleepType = z.enum(Object.values(SleepType) as [string, ...string[]]);

export const appleSleepItem = z.object({
  sourceName: z.string().nullish(),
  sourceId: z.string().nullish(),
  date: z.string(),
  value: z.number(),
  endDate: z.string(),
  type: appleSleepType,
});

export type AppleHealthSleepItem = z.infer<typeof appleSleepItem>;

export const appleWorkoutItem = z.object({
  sourceName: z.string().nullish(),
  sourceId: z.string().nullish(),
  startTime: z.string(),
  endTime: z.string(),
  distance: z.number().optional().nullable(),
  type: z.number(),
  kcal: z.number().optional().nullable(),
  duration: z.number().optional().nullable(),
});

export type AppleHealthWorkoutItem = z.infer<typeof appleWorkoutItem>;

export const appleSchema = z.object({
  // ACTIVITY
  HKQuantityTypeIdentifierActiveEnergyBurned: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierStepCount: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierBasalEnergyBurned: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierFlightsClimbed: z.array(appleItem).optional(),
  HKWorkout: z.array(appleWorkoutItem).optional(),

  // BODY
  HKQuantityTypeIdentifierHeight: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierLeanBodyMass: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierBodyMass: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierBodyFatPercentage: z.array(appleItem).optional(),

  // NUTRITION
  HKQuantityTypeIdentifierDietaryCaffeine: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietaryCalcium: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietaryCarbohydrates: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietaryCholesterol: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietaryCopper: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietaryEnergyConsumed: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietaryFatTotal: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietaryFiber: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietaryFolate: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietaryIodine: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietaryMagnesium: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietaryManganese: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietaryNiacin: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietaryPantothenicAcid: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietaryPhosphorus: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietaryPotassium: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietaryProtein: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietaryRiboflavin: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietarySelenium: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietarySodium: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietarySugar: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietaryThiamin: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietaryVitaminA: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietaryVitaminB6: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietaryVitaminB12: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietaryVitaminC: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietaryVitaminD: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietaryVitaminE: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietaryVitaminK: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietaryWater: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierDietaryZinc: z.array(appleItem).optional(),

  // BIOMETRICS
  HKQuantityTypeIdentifierHeartRate: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierRestingHeartRate: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierBodyTemperature: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierBloodPressureSystolic: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierBloodPressureDiastolic: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierRespiratoryRate: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierOxygenSaturation: z.array(appleItem).optional(),
  HKQuantityTypeIdentifierBloodGlucose: z.array(appleItem).optional(),

  // SLEEP
  HKCategoryValueSleepAnalysis: z.array(appleSleepItem).optional(),
});

export type AppleHealth = z.infer<typeof appleSchema>;
