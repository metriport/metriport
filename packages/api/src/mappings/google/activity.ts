import { Activity } from "@metriport/api-sdk";
import dayjs from "dayjs";
import { sum } from "lodash";
import convert from "convert-units";

import { PROVIDER_GOOGLE } from "../../shared/constants";
import {
  GoogleActivity,
  GoogleActivityTypes,
  sourceIdCalories,
  sourceIdActiveMinutes,
  sourceIdSteps,
  sourceIdDistance,
  sourceIdSpeed,
} from "./models/activity";
import { GoogleSessions } from "./models";
import { getValues, ValueKey } from ".";
import { Util } from "../../shared/util";
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
              active_kcal: sum(values),
            },
          };
        }

        if (data.dataSourceId === sourceIdSteps) {
          activity.summary = {
            ...activity.summary,
            movement: {
              ...activity.summary?.movement,
              steps_count: sum(intValues),
            },
          };
        }

        if (data.dataSourceId === sourceIdDistance) {
          activity.summary = {
            ...activity.summary,
            movement: {
              ...activity.summary?.movement,
              distance_meters: sum(values),
            },
          };
        }

        if (data.dataSourceId === sourceIdSpeed) {
          const convertSpeed = convert(sum(values)).from("m/s").to("km/h");
          const { max_item } = Util.getMinMaxItem(values);

          activity.summary = {
            ...activity.summary,
            movement: {
              ...activity.summary?.movement,
              speed: {
                ...activity.summary?.movement?.speed,
                avg_km_h: convertSpeed,
                max_km_h: convert(max_item).from("m/s").to("km/h"),
              },
            },
          };
        }
      }
    });
  }

  if (googleSessions) {
    const activitySessions = googleSessions.session.filter(
      session => session.activityType !== sessionSleepType
    );

    const activityLogs = activitySessions.map(session => {
      return {
        metadata,
        name: GoogleActivityTypes[session.activityType],
        start_time: dayjs(Number(session.startTimeMillis)).toISOString(),
        end_time: dayjs(Number(session.endTimeMillis)).toISOString(),
      };
    });

    activity.activity_logs = activityLogs;
  }

  return activity;
};
