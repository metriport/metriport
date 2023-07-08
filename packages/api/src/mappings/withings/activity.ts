import { Activity } from "@metriport/api-sdk";
import { ActivityLog } from "@metriport/api-sdk/devices/models/common/activity-log";
import { Metadata } from "@metriport/api-sdk/devices/models/common/metadata";
import dayjs from "dayjs";

import { PROVIDER_WITHINGS } from "../../shared/constants";
import { WithingsActivityLogs } from "./models/activity";
import { WithingsWorkoutLogs } from "./models/workouts";
import { categories } from "./models/workouts";
import { Util } from "../../shared/util";

export const mapToActivity = (
  date: string,
  withingsActivityLogs?: WithingsActivityLogs,
  withingsWorkoutLogs?: WithingsWorkoutLogs
): Activity => {
  const metadata = {
    date: date,
    source: PROVIDER_WITHINGS,
  };
  const activity: Activity = {
    metadata: metadata,
  };

  const activityLogs = formatActivityLogs(metadata, withingsActivityLogs);
  const workoutLogs = formatWorkoutLogs(metadata, withingsWorkoutLogs);

  return { ...activity, activity_logs: [...activityLogs, ...workoutLogs] };
};

const formatActivityLogs = (
  metadata: Metadata,
  withingsActivityLogs?: WithingsActivityLogs
): ActivityLog[] => {
  const activityLogs: ActivityLog[] = [];

  if (withingsActivityLogs) {
    for (const withingsActivityLog of withingsActivityLogs) {
      const activityLog: ActivityLog = {
        metadata: metadata,
      };

      activityLog.durations = {
        active_seconds: withingsActivityLog.active,
        intensity: {
          low_seconds: withingsActivityLog.soft,
          med_seconds: withingsActivityLog.moderate,
          high_seconds: withingsActivityLog.intense,
        },
      };

      activityLog.energy_expenditure = {
        active_kcal: withingsActivityLog.calories,
      };

      activityLog.movement = {
        steps_count: withingsActivityLog.steps,
        floors_count: withingsActivityLog.elevation,
        distance_meters: withingsActivityLog.distance,
      };

      if (
        withingsActivityLog.hr_min ||
        withingsActivityLog.hr_max ||
        withingsActivityLog.hr_average
      ) {
        activityLog.biometrics = {
          heart_rate: {
            ...Util.addDataToObject("min_bpm", withingsActivityLog.hr_min),
            ...Util.addDataToObject("max_bpm", withingsActivityLog.hr_max),
            ...Util.addDataToObject("avg_bpm", withingsActivityLog.hr_average),
          },
        };
      }

      activityLogs.push(activityLog);
    }
  }

  return activityLogs;
};

const formatWorkoutLogs = (
  metadata: Metadata,
  withingsWorkoutLogs?: WithingsWorkoutLogs
): ActivityLog[] => {
  const workoutLogs: ActivityLog[] = [];

  if (withingsWorkoutLogs) {
    for (const withingsWorkoutLog of withingsWorkoutLogs) {
      const workoutLog: ActivityLog = {
        metadata: metadata,
        start_time: dayjs.unix(withingsWorkoutLog.startdate).toISOString(),
        end_time: dayjs.unix(withingsWorkoutLog.enddate).toISOString(),
        name: categories[withingsWorkoutLog.category],
      };

      if (withingsWorkoutLog.data) {
        const { manual_calories } = withingsWorkoutLog.data;

        if (manual_calories) {
          workoutLog.energy_expenditure = {
            ...Util.addDataToObject("active_kcal", manual_calories),
          };
        }

        const { steps, elevation, distance } = withingsWorkoutLog.data;

        workoutLog.movement = {
          ...Util.addDataToObject("steps_count", steps),
          ...Util.addDataToObject("floors_count", elevation),
          ...Util.addDataToObject("distance_meters", distance),
        };

        const { hr_max, hr_min, hr_average, spo2_average } = withingsWorkoutLog.data;

        if (hr_min || hr_max || hr_average || spo2_average) {
          workoutLog.biometrics = {};

          if (hr_min || hr_max || hr_average) {
            workoutLog.biometrics = {
              ...workoutLog.biometrics,
              heart_rate: {
                ...Util.addDataToObject("min_bpm", hr_min),
                ...Util.addDataToObject("max_bpm", hr_max),
                ...Util.addDataToObject("avg_bpm", hr_average),
              },
            };
          }

          if (spo2_average) {
            workoutLog.biometrics = {
              ...workoutLog.biometrics,
              respiration: {
                spo2: {
                  ...Util.addDataToObject("avg_pct", spo2_average),
                },
              },
            };
          }
        }
      }

      workoutLogs.push(workoutLog);
    }
  }

  return workoutLogs;
};
