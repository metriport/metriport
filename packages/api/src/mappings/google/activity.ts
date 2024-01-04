import { Activity } from "@metriport/api-sdk";
import { ActivityLog } from "@metriport/api-sdk/devices/models/common/activity-log";
import convert from "convert-units";
import dayjs from "dayjs";
import { sum } from "lodash";
import { getValues, ValueKey } from ".";
import { PROVIDER_GOOGLE } from "../../shared/constants";
import { Util } from "../../shared/util";
import { GooglePoint, GoogleSessions, SingleGooglePoint } from "./models";
import {
  GoogleActivity,
  GoogleActivityTypes,
  sourceIdActiveMinutes,
  sourceIdCalories,
  sourceIdDistance,
  sourceIdSpeed,
  sourceIdSteps,
} from "./models/activity";
import { sessionSleepType } from "./models/sleep";
import { formatNumber } from "@metriport/shared/common/numbers";

export const mapToActivity = (
  date: string,
  googleActivity?: GoogleActivity,
  googleSessions?: GoogleSessions
): Activity => {
  const metadata = {
    date: date,
    source: PROVIDER_GOOGLE,
  };

  const activity: Activity = {
    metadata: metadata,
  };

  if (googleSessions) {
    const activitySessions = googleSessions.session.filter(
      session => session.activityType !== sessionSleepType
    );

    const activityLogs = activitySessions.map(session => {
      return {
        metadata,
        name: GoogleActivityTypes[session.activityType],
        start_time: getISOString(session.startTimeMillis),
        end_time: getISOString(session.endTimeMillis),
      };
    });

    activity.activity_logs = activityLogs;
  }

  if (googleActivity) {
    googleActivity.bucket[0].dataset.forEach(data => {
      if (data.point.length) {
        const values = getValues(data.point);
        const intValues = getValues(data.point, ValueKey.intVal);

        if (data.dataSourceId === sourceIdActiveMinutes) {
          const seconds = convert(sum(intValues)).from("min").to("s");
          activity.summary = {
            ...activity.summary,
            durations: {
              ...activity.summary?.durations,
              active_seconds: seconds,
            },
          };

          let actTotalSeconds = 0;

          activity.activity_logs = activity.activity_logs?.map(act => {
            data.point.find(point => {
              const foundMatch = matchActivityTime(
                act.start_time,
                act.end_time,
                parseInt(point.startTimeNanos)
              );
              if (foundMatch) {
                actTotalSeconds += calculateActiveSeconds(point.startTimeNanos, point.endTimeNanos);
              }
            });
            act = {
              ...act,
              durations: {
                ...act.durations,
                active_seconds: actTotalSeconds,
              },
            };
            actTotalSeconds = 0;
            return act;
          });
        }

        if (data.dataSourceId === sourceIdCalories) {
          activity.summary = {
            ...activity.summary,
            energy_expenditure: {
              active_kcal: formatNumber(sum(values)),
            },
          };
          activity.activity_logs =
            activity.activity_logs &&
            updateActivityLogs(
              activity.activity_logs,
              data.point,
              "fpVal",
              (activityLog: ActivityLog, updatedValue: number) => {
                return {
                  ...activityLog,
                  energy_expenditure: {
                    active_kcal: formatNumber(updatedValue),
                  },
                };
              }
            );
        }

        if (data.dataSourceId === sourceIdSteps) {
          activity.summary = {
            ...activity.summary,
            movement: {
              ...activity.summary?.movement,
              steps_count: sum(intValues),
            },
          };
          activity.activity_logs =
            activity.activity_logs &&
            updateActivityLogs(
              activity.activity_logs,
              data.point,
              "intVal",
              (act: ActivityLog, updatedValue: number) => {
                return {
                  ...act,
                  movement: {
                    ...act.movement,
                    steps_count: updatedValue,
                  },
                };
              }
            );
        }
        if (data.dataSourceId === sourceIdDistance) {
          activity.summary = {
            ...activity.summary,
            movement: {
              ...activity.summary?.movement,
              distance_meters: sum(values),
            },
          };
          activity.activity_logs =
            activity.activity_logs &&
            updateActivityLogs(
              activity.activity_logs,
              data.point,
              "fpVal",
              (act: ActivityLog, updatedValue: number) => {
                return {
                  ...act,
                  movement: {
                    ...act.movement,
                    distance_meters: updatedValue,
                  },
                };
              }
            );
        }

        const activitySpeedTimeMap: { speed: number; totalTime: number }[] = [];

        if (data.dataSourceId === sourceIdSpeed) {
          activity.activity_logs =
            activity.activity_logs &&
            updateActivityLogs(
              activity.activity_logs,
              data.point,
              "fpVal",
              (act: ActivityLog, updatedValue: number) => {
                if (act.start_time && act.end_time) {
                  const totalSeconds = convert(
                    nanoTimeString(act.end_time) - nanoTimeString(act.start_time)
                  )
                    .from("ns")
                    .to("s");
                  activitySpeedTimeMap.push({
                    speed: formatNumber(convert(updatedValue).from("m/s").to("km/h")),
                    totalTime: convert(totalSeconds).from("s").to("h"),
                  });
                }

                return {
                  ...act,
                  movement: {
                    ...act.movement,
                    speed: {
                      ...act.movement?.speed,
                      avg_km_h: formatNumber(convert(updatedValue).from("m/s").to("km/h")),
                    },
                  },
                };
              }
            );

          const avgSpeed = calculateAvgSpeed(activitySpeedTimeMap);
          const { max_item } = Util.getMinMaxItem(values);

          activity.summary = {
            ...activity.summary,
            movement: {
              ...activity.summary?.movement,
              speed: {
                ...activity.summary?.movement?.speed,
                avg_km_h: avgSpeed,
                max_km_h: formatNumber(convert(max_item).from("m/s").to("km/h")),
              },
            },
          };
        }
      }
    });
  }

  return activity;
};

function nanoTimeString(startTime: string | undefined): number {
  if (startTime) {
    const dateObject = new Date(startTime);
    const timeInNanoseconds = convert(dateObject.getTime()).from("ms").to("ns");
    return timeInNanoseconds;
  }
  return 0;
}

function matchActivityTime(
  activityStartTime: string | undefined,
  activityEndTime: string | undefined,
  startTimeNanos: number
): boolean {
  return (
    nanoTimeString(activityStartTime) <= startTimeNanos &&
    startTimeNanos < nanoTimeString(activityEndTime)
  );
}

function calculateAvgSpeed(activitySpeedTimeMap: { speed: number; totalTime: number }[]) {
  let totalDistance = 0;
  let totalTime = 0;

  activitySpeedTimeMap.forEach(d => {
    totalDistance += d.speed * d.totalTime;
    totalTime += d.totalTime;
  });

  return formatNumber(totalDistance / totalTime);
}

function calculateActiveSeconds(startTimeNanos: string, endTimeNanos: string): number {
  return formatNumber(
    convert(parseInt(endTimeNanos) - parseInt(startTimeNanos))
      .from("ns")
      .to("s")
  );
}

function getISOString(timeMillis: string): string {
  return dayjs(Number(timeMillis)).toISOString();
}

function updateActivityLogs(
  activityLogs: ActivityLog[],
  dataPoint: GooglePoint,
  valueKey: "fpVal" | "intVal",
  updateEntry: (act: ActivityLog, updatedValue: number) => Activity
) {
  return activityLogs?.map(entry => {
    const matchingActivity = dataPoint.find((point: SingleGooglePoint) =>
      matchActivityTime(entry.start_time, entry.end_time, parseInt(point.startTimeNanos))
    );
    const propValue =
      matchingActivity && matchingActivity.value.length
        ? matchingActivity.value[0][valueKey]
        : undefined;
    if (matchingActivity && propValue) {
      return updateEntry(entry, propValue);
    }
    return entry;
  });
}
