import { z } from "zod";

// https://dev.fitbit.com/build/reference/web-api/activity/get-activity-log-list/
export const fitbitActivityLogResp = z.array(
  z.object({
    activeDuration: z.number().nullable().optional(),
    activeZoneMinutes: z
      .object({
        minutesInHeartRateZones: z
          .array(
            z.object({
              minuteMultiplier: z.number(),
              minutes: z.number(),
              order: z.number(),
              type: z.string(),
              zoneName: z.string(),
            })
          )
          .nullable()
          .optional(),
        totalMinutes: z.number().nullable().optional(),
      })
      .nullable()
      .optional(),
    activityLevel: z
      .array(
        z.object({
          minutes: z.number(),
          name: z.string(),
        })
      )
      .nullable()
      .optional(),
    activityName: z.string().nullable().optional(),
    activityTypeId: z.number().nullable().optional(),
    averageHeartRate: z.number().nullable().optional(),
    calories: z.number().nullable().optional(),
    caloriesLink: z.string().nullable().optional(),
    distance: z.number().nullable().optional(),
    distanceUnit: z.string().nullable().optional(),
    duration: z.number().nullable().optional(),
    elevationGain: z.number().nullable().optional(),
    hasActiveZoneMinutes: z.boolean().nullable().optional(),
    heartRateLink: z.string().nullable().optional(),
    heartRateZones: z
      .array(
        z.object({
          caloriesOut: z.number().nullish(),
          max: z.number(),
          min: z.number(),
          minutes: z.number(),
          name: z.string(),
        })
      )
      .nullable()
      .optional(),
    lastModified: z.string().nullable().optional(),
    logId: z.number().nullable().optional(),
    logType: z.string().nullable().optional(),
    manualValuesSpecified: z
      .object({
        calories: z.boolean().nullable().optional(),
        distance: z.boolean().nullable().optional(),
        steps: z.boolean().nullable().optional(),
      })
      .nullable()
      .optional(),
    originalDuration: z.number().nullable().optional(),
    originalStartTime: z.string().nullable().optional(),
    pace: z.number().nullable().optional(),
    source: z
      .object({
        id: z.string().nullable().optional(),
        name: z.string().nullable().optional(),
        trackerFeatures: z.array(z.string().nullable().optional()),
        type: z.string().nullable().optional(),
        url: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    speed: z.number().nullable().optional(),
    startTime: z.string().nullable().optional(),
    steps: z.number().nullable().optional(),
    tcxLink: z.string().nullable().optional(),
  })
);

export type FitbitActivityLogs = z.infer<typeof fitbitActivityLogResp>;

export interface HeartRateZone {
  caloriesOut?: number | null;
  max?: number | null;
  min?: number | null;
  minutes?: number | null;
  name?: string | null;
}
