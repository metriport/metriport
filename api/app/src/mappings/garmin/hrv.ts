import { Biometrics } from "@metriport/api";
import { Sample } from "@metriport/api/lib/devices/models/common/sample";
import dayjs from "dayjs";
import { groupBy } from "lodash";
import { z } from "zod";
import { DataType, garminMetaSchema, garminTypes, garminUnits, User, UserData } from ".";
import { PROVIDER_GARMIN } from "../../shared/constants";

export const mapToBiometricsFromHRV = (items: GarminHRVList): UserData<Biometrics>[] => {
  const type: DataType = "biometrics";
  const itemsByUAT = groupBy(items, a => a.userAccessToken);
  return Object.entries(itemsByUAT).flatMap(([key, values]) => {
    const uat = key;
    const userData = values;
    const user: User = {
      userAccessToken: uat,
    };
    const mappedItems = userData.map(garminHRVToBody);
    const definedItems: Biometrics[] = mappedItems.filter(
      (v: Biometrics | undefined) => v != undefined
    ) as Biometrics[];
    return definedItems.map(data => ({
      user,
      typedData: { type, data },
    }));
  });
};

export const garminHRVToBody = (gBody: GarminHRV): Biometrics | undefined => {
  const bio: Biometrics = {
    metadata: {
      date: gBody.calendarDate,
      source: PROVIDER_GARMIN,
    },
  };
  if (gBody.lastNightAvg != null || gBody.hrvValues != null) {
    const samples_millis = getHRVSamples(gBody.hrvValues, gBody.startTimeInSeconds);
    bio.hrv = {
      // Choosing RMSSD bc docs hint at it on 7.10 (health snapshot) and this page:
      // https://www.garmin.com/en-US/garmin-technology/running-science/physiological-measurements/hrv-status/
      rmssd: {
        avg_millis: gBody.lastNightAvg,
        ...(samples_millis ? { samples_millis } : undefined),
      },
    };
    return bio;
  }
  return undefined;
};

export const getHRVSamples = (
  samples: GarminHRV["hrvValues"],
  startTime: number
): Sample[] | undefined => {
  if (!samples) return undefined;

  return Object.entries(samples).map(([key, value]) => {
    return {
      time: dayjs.unix(startTime + Number(key)).toISOString(),
      value,
    };
  });
};

export const garminHRVSchema = z.object({
  calendarDate: garminTypes.date,
  startTimeInSeconds: garminTypes.startTime,
  // startTimeOffsetInSeconds: -21600, // we always use UTC
  // durationInSeconds: garminTypes.duration.nullable().optional(), // not being used
  lastNightAvg: garminTypes.hrvAverage,
  // lastNight5MinHigh: 93, // not being used
  hrvValues: z.record(garminUnits.timeKey, garminTypes.hrv).nullable().optional(),
});
export type GarminHRV = z.infer<typeof garminHRVSchema>;

export const garminHRVWithMetaSchema = garminMetaSchema.merge(garminHRVSchema);
export type GarminHRVWithMeta = z.infer<typeof garminHRVWithMetaSchema>;

export const garminHRVListSchema = z.array(garminHRVWithMetaSchema);
export type GarminHRVList = z.infer<typeof garminHRVListSchema>;
