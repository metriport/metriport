import { Activity } from "@metriport/api-sdk";
import convert from "convert-units";
import dayjs from "dayjs";
import { sum } from "lodash";

import { ValueKey, getValues } from ".";
import { PROVIDER_GOOGLE } from "../../shared/constants";
import { Util } from "../../shared/util";
import { GoogleSessions } from "./models";
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
      const isoStringDate = dayjs(Number(session.startTimeMillis)).toISOString();

      return {
        metadata,
        name: GoogleActivityTypes[session.activityType],
        start_time: isoStringDate,
        end_time: dayjs(Number(session.endTimeMillis)).toISOString(),
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
        }

        if (data.dataSourceId === sourceIdCalories) {
          activity.summary = {
            ...activity.summary,
            energy_expenditure: {
              active_kcal: formatNumber(sum(values)),
            },
          };
          activity.activity_logs = activity.activity_logs?.map(act => {
            const matchingActivity = data.point.find(point =>
              matchActivityTime(act.start_time, act.end_time, parseInt(point.startTimeNanos))
            );
            if (matchingActivity && matchingActivity.value[0].fpVal) {
              act = {
                ...act,
                energy_expenditure: {
                  active_kcal: formatNumber(matchingActivity.value[0].fpVal),
                },
              };
            }
            return act;
          });
        }

        if (data.dataSourceId === sourceIdSteps) {
          activity.summary = {
            ...activity.summary,
            movement: {
              ...activity.summary?.movement,
              steps_count: sum(intValues),
            },
          };
          activity.activity_logs = activity.activity_logs?.map(act => {
            const matchingActivity = data.point.find(point =>
              matchActivityTime(act.start_time, act.end_time, parseInt(point.startTimeNanos))
            );
            if (matchingActivity) {
              act = {
                ...act,
                movement: {
                  ...act.movement,
                  steps_count: matchingActivity.value[0].intVal,
                },
              };
            }
            return act;
          });
        }

        if (data.dataSourceId === sourceIdDistance) {
          activity.summary = {
            ...activity.summary,
            movement: {
              ...activity.summary?.movement,
              distance_meters: sum(values),
            },
          };
          activity.activity_logs = activity.activity_logs?.map(act => {
            const matchingActivity = data.point.find(point =>
              matchActivityTime(act.start_time, act.end_time, parseInt(point.startTimeNanos))
            );
            if (matchingActivity) {
              act = {
                ...act,
                movement: {
                  ...act.movement,
                  distance_meters: matchingActivity.value[0].fpVal,
                },
              };
            }
            return act;
          });
        }

        const activitySpeedTimeMap: { speed: number; totalSeconds: number }[] = [];

        if (data.dataSourceId === sourceIdSpeed) {
          activity.activity_logs = activity.activity_logs?.map(act => {
            const matchingActivity = data.point.find(point =>
              matchActivityTime(act.start_time, act.end_time, parseInt(point.startTimeNanos))
            );
            if (matchingActivity) {
              act = {
                ...act,
                movement: {
                  ...act.movement,
                  speed: {
                    ...act.movement?.speed,
                    avg_km_h: formatNumber(
                      convert(matchingActivity.value[0].fpVal).from("m/s").to("km/h")
                    ),
                  },
                },
              };
              if (act.start_time && act.end_time) {
                const totalSeconds =
                  (nanoTimeString(act.end_time) - nanoTimeString(act.start_time)) / 1e9;
                activitySpeedTimeMap.push({
                  speed: formatNumber(
                    convert(matchingActivity.value[0].fpVal).from("m/s").to("km/h")
                  ),
                  totalSeconds,
                });
              }
            }
            return act;
          });

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
    const timeInNanoseconds = dateObject.getTime() * 1e6;
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

function formatNumber(num: number): number {
  return parseInt((num * 100).toFixed(2)) / 100;
}

function calculateAvgSpeed(activitySpeedTimeMap: { speed: number; totalSeconds: number }[]) {
  let totalDistance = 0;
  let totalTime = 0;

  activitySpeedTimeMap.forEach(d => {
    totalDistance += (d.speed * d.totalSeconds) / 3600;
    totalTime += d.totalSeconds;
  });

  return formatNumber((totalDistance / totalTime) * 3600);
}
