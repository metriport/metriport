import { Activity } from "@metriport/api-sdk";
import { ActivityLog } from "@metriport/api-sdk/devices/models/common/activity-log";
import dayjs from "dayjs";
import convert from "convert-units";

import { PROVIDER_FITBIT } from "../../shared/constants";
import { FitbitActivityLogs, HeartRateZone } from "./models/activity-log";
import { Util } from "../../shared/util";
import { ISO_DATE } from "../../shared/date";

export const mapToActivity = (fitbitActiveLogs: FitbitActivityLogs, date: string): Activity => {
  const filteredLogs = filterLogsByDate(fitbitActiveLogs, date);

  const metadata = {
    date: date,
    source: PROVIDER_FITBIT,
  };
  const activity: Activity = {
    metadata: metadata,
  };

  const activityLogs: ActivityLog[] = [];

  for (const fitbitActivityLog of filteredLogs) {
    const activeSeconds = fitbitActivityLog.activeDuration
      ? convert(fitbitActivityLog.activeDuration).from("ms").to("s")
      : undefined;
    const activityLog: ActivityLog = {
      metadata: metadata,
      ...Util.addDataToObject("name", fitbitActivityLog.activityName),
      ...Util.addDataToObject("start_time", fitbitActivityLog.originalStartTime),
      durations: {
        ...Util.addDataToObject("active_seconds", activeSeconds),
      },
      movement: {
        ...Util.addDataToObject("steps_count", fitbitActivityLog.steps),
      },
    };

    if (fitbitActivityLog.calories) {
      activityLog.energy_expenditure = {
        ...activityLog.energy_expenditure,
        active_kcal: fitbitActivityLog.calories,
      };
    }

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

    // if (fitbitActivityLog.hasActiveZoneMinutes && fitbitActivityLog.heartRateZones) {
    //   const heartZones = fitbitActivityLog.heartRateZones;

    // TODO #805: Include a more thorough breakdown of the heart rate data to get the actual min and max bpm, instead of relying on heartRateZones
    // https://github.com/metriport/metriport/issues/805
    //   const { min_item, max_item } = findMinMaxHeartRate(heartZones);

    //   activityLog.biometrics = {
    //     heart_rate: {
    //       min_bpm: min_item,
    //       max_bpm: max_item,
    //     },
    //   };
    // }

    if (fitbitActivityLog.averageHeartRate) {
      activityLog.biometrics = {
        ...activityLog.biometrics,
        heart_rate: {
          ...activityLog.biometrics?.heart_rate,
          avg_bpm: fitbitActivityLog.averageHeartRate,
        },
      };
    }

    activityLogs.push(activityLog);
  }

  return { ...activity, activity_logs: activityLogs };
};

const filterLogsByDate = (logs: FitbitActivityLogs, date: string): FitbitActivityLogs => {
  const filteredLogs = logs.filter(log => {
    const originalDate = dayjs(log.originalStartTime).format(ISO_DATE);

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

export const findMinMaxHeartRate = (heartRateZones: HeartRateZone[]) => {
  const relevantZones = heartRateZones.filter(
    heartRate => heartRate.minutes && heartRate.minutes > 0
  );

  const getHeartRates = relevantZones.reduce((acc: number[], heartRate) => {
    if (heartRate.max) {
      acc.push(heartRate.max);
    }

    if (heartRate.min) {
      acc.push(heartRate.min);
    }

    return acc;
  }, []);

  return Util.getMinMaxItem(getHeartRates);
};
