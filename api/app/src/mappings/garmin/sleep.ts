import { Sleep } from "@metriport/api";
import {
  SleepBiometrics,
  SleepDurations,
} from "@metriport/api/lib/models/sleep";
import { groupBy } from "lodash";
import { z } from "zod";
import { garminMetaSchema, garminTypes as t, User, UserData } from ".";
import { PROVIDER_GARMIN } from "../../shared/constants";
import { toISODate, toISODateTime } from "../../shared/date";

export const mapToSleep = (sleepList: GarminSleepList): UserData<Sleep>[] => {
  const type = "sleep";
  const byUAT = groupBy(sleepList, (a) => a.userAccessToken);
  return Object.entries(byUAT).flatMap(([key, values]) => {
    const uat = key;
    const userData = values;
    const user: User = {
      userAccessToken: uat,
    };
    return userData
      .map(garminSleepToSleep)
      .map((data) => ({ user, typedData: { type, data } }));
  });
};

export const garminSleepToSleep = (gSleep: GarminSleep): Sleep => {
  const res: Sleep = {
    metadata: {
      date: toISODate(gSleep.startTimeInSeconds),
      source: PROVIDER_GARMIN,
    },
  };
  res.start_time = toISODateTime(gSleep.startTimeInSeconds);
  if (gSleep.durationInSeconds != null) {
    res.end_time = toISODateTime(
      gSleep.startTimeInSeconds + gSleep.durationInSeconds
    );
  }
  res.durations = toDurations(gSleep);
  res.biometrics = toBiometrics(gSleep);
  return res;
};

export const toDurations = (
  gSleep: GarminSleep
): SleepDurations | undefined => {
  const res: SleepDurations = {};
  if (gSleep.durationInSeconds != null) {
    res.total_seconds = gSleep.durationInSeconds;
  }
  if (gSleep.awakeDurationInSeconds != null) {
    res.awake_seconds = gSleep.awakeDurationInSeconds;
  }
  if (gSleep.deepSleepDurationInSeconds != null) {
    res.deep_seconds = gSleep.deepSleepDurationInSeconds;
  }
  if (gSleep.remSleepInSeconds != null) {
    res.rem_seconds = gSleep.remSleepInSeconds;
  }
  if (gSleep.lightSleepDurationInSeconds != null) {
    res.light_seconds = gSleep.lightSleepDurationInSeconds;
  }
  if (gSleep.unmeasurableSleepInSeconds != null) {
    res.no_data_seconds = gSleep.unmeasurableSleepInSeconds;
  }
  return Object.keys(res).length > 0 ? res : undefined;
};

// https://github.com/metriport/metriport-internal/issues/161
export const toBiometrics = (
  gSleep: GarminSleep
): SleepBiometrics | undefined => {
  /*
  "gSleep.timeOffsetSleepRespiration"

  Collection of key-value pairs where the key is offset in seconds from the startTimeInSeconds
  and respiration measurement taken at that time. Respiration measurement is in breaths per minute.

  “timeOffsetSleepRespiration”: {
    “60”: 15.31,
    “120”: 14.58,
    “180”: 12.73,
    “240”: 12.87
  }
  */

  /*
  "gSleep.timeOffsetSleepSpo2"

  A map of SpO2 readings, where the keys are the offsets in seconds from the startTimeInSeconds
  and the values are the SpO2 measurements at that time. Only present if the user’s device is
  SpO2-enabled.

  “timeOffsetSleepSpo2”: {
    “0”: 95,
    “60”: 96,
    “120”: 97,
    “180”: 93,
    “240”: 94,
    “300”: 95,
    “360”: 96
  },
  */
  return undefined;
};

export const garminSleepSchema = z.object({
  // calendarDate: t.date, // getting this from 'startTimeInSeconds'
  startTimeInSeconds: t.startTime,
  // startTimeOffsetInSeconds: -21600, // always return UTC
  durationInSeconds: t.duration,
  unmeasurableSleepInSeconds: t.unmeasurableSleep,
  deepSleepDurationInSeconds: t.deepSleepDuration,
  lightSleepDurationInSeconds: t.lightSleepDuration,
  remSleepInSeconds: t.remSleep,
  awakeDurationInSeconds: t.awakeDuration,
  sleepLevelsMap: t.sleepLevels,
  // relays the validation state of the sleep data and its date range
  // could be used to filter out data - see docs
  validation: t.sleepValidation,
  timeOffsetSleepRespiration: t.timeOffsetSleepRespiration,
  timeOffsetSleepSpo2: t.timeOffsetSleepSpo2,
  overallSleepScore: t.overallSleepScore,
});
export type GarminSleep = z.infer<typeof garminSleepSchema>;

export const garminSleepWithMetaSchema =
  garminMetaSchema.merge(garminSleepSchema);
export type GarminSleepWithMeta = z.infer<typeof garminSleepWithMetaSchema>;

export const garminSleepListSchema = z.array(garminSleepWithMetaSchema);
export type GarminSleepList = z.infer<typeof garminSleepListSchema>;
