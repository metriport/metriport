import {
  Activity as MetriportActivity,
  Biometrics as MetriportBiometrics,
} from "@metriport/api-sdk";
import { z } from "zod";

import { PROVIDER_OURA } from "../../shared/constants";
import { Util } from "../../shared/util";
import { streamingDataSchema } from ".";

export const mapToActivity = (
  date: string,
  ouraDailyActivity?: OuraDailyActivity,
  biometrics?: MetriportBiometrics,
  sessions?: OuraSessions,
  workouts?: OuraWorkouts
): MetriportActivity => {
  const activityLogs = getActivityLogs(sessions, workouts);

  return {
    metadata: {
      date: date,
      source: PROVIDER_OURA,
    },
    summary: {
      durations: {
        intensity: {
          rest_seconds: ouraDailyActivity?.resting_time,
          low_seconds: ouraDailyActivity?.low_activity_time,
          very_low_seconds: ouraDailyActivity?.sedentary_time,
          med_seconds: ouraDailyActivity?.medium_activity_time,
          high_seconds: ouraDailyActivity?.high_activity_time,
        },
      },
      movement: {
        steps_count: ouraDailyActivity?.steps,
        distance_meters: ouraDailyActivity?.equivalent_walking_distance,
      },
      biometrics: {
        heart_rate: {
          ...biometrics?.heart_rate,
        },
      },
    },
    activity_logs: activityLogs,
  };
};

const getActivityLogs = (sessions?: OuraSessions, workouts?: OuraWorkouts) => {
  const sessionLogs = transformSessionsToActivityLogs(sessions);
  const workoutLogs = transformWorkoutsToActivityLogs(workouts);

  return [...sessionLogs, ...workoutLogs];
};

const transformSessionsToActivityLogs = (sessions?: OuraSessions) => {
  if (sessions && sessions.length) {
    return sessions.map(session => {
      const defaultPayload = {
        metadata: {
          date: session.day,
          source: PROVIDER_OURA,
        },
        type: session.type,
        start_time: session.start_datetime,
        end_time: session.end_datetime,
      };

      if (session.heart_rate.items && session.heart_rate.items.length) {
        const { min_item, max_item } = Util.getMinMaxItem(session.heart_rate.items);
        const avg_heart_rate = Util.getAvgOfArr(session.heart_rate.items);

        return {
          ...defaultPayload,
          biometrics: {
            heart_rate: {
              min_bpm: min_item,
              max_bpm: max_item,
              avg_bpm: avg_heart_rate,
            },
          },
        };
      }

      return defaultPayload;
    });
  }

  return [];
};

const transformWorkoutsToActivityLogs = (workouts?: OuraWorkouts) => {
  if (workouts && workouts.length) {
    return workouts.map(workout => {
      return {
        metadata: {
          date: workout.day,
          source: PROVIDER_OURA,
        },
        type: workout.activity,
        start_time: workout.start_datetime,
        end_time: workout.end_datetime,
        movement: {
          distance_meters: workout.distance,
        },
      };
    });
  }

  return [];
};

// Data retrieved from https://cloud.ouraring.com/v2/docs#tag/Daily-Activity
export const ouraDailyActivityResponse = z
  .object({
    class_5_min: z.string().nullable().optional(),
    score: z.number().nullable().optional(),
    active_calories: z.number(),
    average_met_minutes: z.number(),
    contributors: z.object({
      meet_daily_targets: z.number(),
      move_every_hour: z.number(),
      recovery_time: z.number(),
      stay_active: z.number(),
      training_frequency: z.number(),
      training_volume: z.number(),
    }),
    equivalent_walking_distance: z.number(),
    high_activity_met_minutes: z.number(),
    high_activity_time: z.number(),
    inactivity_alerts: z.number(),
    low_activity_met_minutes: z.number(),
    low_activity_time: z.number(),
    medium_activity_met_minutes: z.number(),
    medium_activity_time: z.number(),
    met: streamingDataSchema,
    meters_to_target: z.number(),
    non_wear_time: z.number(),
    resting_time: z.number(),
    sedentary_met_minutes: z.number(),
    sedentary_time: z.number(),
    steps: z.number(),
    target_calories: z.number(),
    target_meters: z.number(),
    total_calories: z.number(),
    day: z.string(),
    timestamp: z.string(),
  })
  .optional();

export type OuraDailyActivity = z.infer<typeof ouraDailyActivityResponse>;

// Data retrieved from https://cloud.ouraring.com/v2/docs#tag/Sessions
export const ouraSessionsResponse = z.array(
  z.object({
    day: z.string(),
    start_datetime: z.string(),
    end_datetime: z.string(),
    type: z.string(),
    heart_rate: streamingDataSchema,
    heart_rate_variability: streamingDataSchema,
    mood: z.string().nullable().optional(),
    motion_count: streamingDataSchema,
  })
);

export type OuraSessions = z.infer<typeof ouraSessionsResponse>;

// Data retrieved from https://cloud.ouraring.com/v2/docs#tag/Workouts
export const ouraWorkoutsResponse = z.array(
  z.object({
    activity: z.string(),
    calories: z.number().nullable().optional(),
    day: z.string(),
    distance: z.number(),
    end_datetime: z.string(),
    intensity: z.string(),
    label: z.string().nullable().optional(),
    source: z.string(),
    start_datetime: z.string(),
  })
);

export type OuraWorkouts = z.infer<typeof ouraWorkoutsResponse>;
