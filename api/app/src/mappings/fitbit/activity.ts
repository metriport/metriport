import { Activity } from "@metriport/api";
import { ActivityLog } from "@metriport/api/lib/models/common/activity-log";
import dayjs from "dayjs";
import convert from "convert-units";

import { PROVIDER_FITBIT } from "../../shared/constants";
import { FitbitActivityLogs, HeartRateZone } from "./models/activity-log";
import { Util } from "../../shared/util";

export const mapToActivity = (fitbitActiveLogs: FitbitActivityLogs, date: string): Activity => {
  const filteredLogs = filterLogsByDate(fitbitActiveLogs, date);

  const metadata = {
    date: date,
    source: PROVIDER_FITBIT,
  };
  let activity: Activity = {
    metadata: metadata,
  };

  const activityLogs: ActivityLog[] = [];

  for (const fitbitActivityLog of filteredLogs) {
    let activityLog: ActivityLog = {
      metadata: metadata,
      ...Util.addDataToObject("name", fitbitActivityLog.activityName),
      ...Util.addDataToObject("start_time", fitbitActivityLog.originalStartTime),
      durations: {
        ...Util.addDataToObject("active_seconds", fitbitActivityLog.activeDuration),
      },
      movement: {
        ...Util.addDataToObject("steps_count", fitbitActivityLog.steps),
      },
    };

    if (fitbitActivityLog.activityLevel && fitbitActivityLog.activityLevel.length) {
      const level = fitbitActivityLog.activityLevel;
      activityLog.durations = {
        ...activityLog.durations,
        strain: {
          ...Util.addDataToObject(
            "rest_seconds",
            findAndConvertActivityLevelToSec("sedentary", level)
          ),
          ...Util.addDataToObject(
            "low_seconds",
            findAndConvertActivityLevelToSec("lightly", level)
          ),
          ...Util.addDataToObject("med_seconds", findAndConvertActivityLevelToSec("fairly", level)),
          ...Util.addDataToObject("high_seconds", findAndConvertActivityLevelToSec("very", level)),
        },
      };
    }

    if (fitbitActivityLog.elevationGain) {
      activityLog.movement = {
        ...activityLog.movement,
        elevation: {
          ...Util.addDataToObject(
            "gain_meters",
            convert(fitbitActivityLog.elevationGain).from("km").to("m")
          ),
        },
      };
    }

    if (fitbitActivityLog.speed) {
      activityLog.movement = {
        ...activityLog.movement,
        speed: {
          ...Util.addDataToObject("avg_km_h", fitbitActivityLog.speed),
        },
      };
    }

    if (fitbitActivityLog.distance) {
      activityLog.movement = {
        ...activityLog.movement,
        ...Util.addDataToObject(
          "distance_meters",
          convert(fitbitActivityLog.distance).from("km").to("m")
        ),
      };
    }

    if (fitbitActivityLog.hasActiveZoneMinutes) {
      const heartZones = fitbitActivityLog.heartRateZones!;

      const { min_item, max_item } = findMinMaxHeartRate(heartZones);

      activityLog.biometrics = {
        heart_rate: {
          min_bpm: min_item,
          max_bpm: max_item,
        },
      };
    }

    activityLogs.push(activityLog);
  }

  return { ...activity, activity_logs: activityLogs };
};

const filterLogsByDate = (logs: FitbitActivityLogs, date: string): FitbitActivityLogs => {
  const filteredLogs = logs.filter(log => {
    const originalDate = dayjs(log.originalStartTime).format("YYYY-MM-DD");

    return originalDate === date;
  });

  return filteredLogs;
};

const findAndConvertActivityLevelToSec = (
  type: string,
  arr: Array<{ name: string; minutes: number }>
): number | undefined => {
  const level = arr.find(level => type === level.name);

  if (level?.minutes) {
    return level.minutes * 60;
  }

  return undefined;
};

export const findMinMaxHeartRate = (heartrateZones: HeartRateZone[]) => {
  const acceptableHeartRateZones = heartrateZones.filter(
    heartRate => heartRate.name !== "Out of Range"
  );
  const getHeartRates = acceptableHeartRateZones.reduce((acc: number[], heartRate) => {
    if (heartRate.name !== "Out of Range") {
      acc.push(heartRate.max);
      acc.push(heartRate.min);
    }

    return acc;
  }, []);

  return Util.getMinMaxItem(getHeartRates);
};
