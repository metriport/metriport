import { Biometrics } from "@metriport/api-sdk";
import dayjs from "dayjs";
import { groupBy } from "lodash";
import { z } from "zod";
import { garminMetaSchema, garminTypes, User, UserData } from ".";
import { PROVIDER_GARMIN } from "../../shared/constants";
import { secondsToISODate } from "../../shared/date";

type BreathAndDate = { date: string; breath: { time: string; value: number } };

export const mapToBiometricsFromRespiration = (
  items: GarminRespirationList
): UserData<Biometrics>[] => {
  const type = "biometrics";
  // group by user
  const itemsByUAT = groupBy(items, a => a.userAccessToken);
  return Object.entries(itemsByUAT).flatMap(([key, values]) => {
    const uat = key;
    const userData = values;
    const user: User = {
      userAccessToken: uat,
    };
    // flat list of user breaths/samples with date
    const breaths = toBreaths(userData);
    // now group those breaths by date and return as a Biometrics
    const breathsByDate = groupBy(breaths, i => i.date);
    const toUserBiometrics = (date: string): UserData<Biometrics> => {
      const breathsOfDate = breathsByDate[date];
      return {
        user,
        typedData: {
          type,
          data: {
            metadata: { date, source: PROVIDER_GARMIN },
            respiration: {
              samples_breaths_per_minute: breathsOfDate.map(v => v.breath),
            },
          },
        },
      };
    };
    return Object.keys(breathsByDate).map(toUserBiometrics);
  });
};

const toBreaths = (userData: GarminRespirationList): BreathAndDate[] => {
  const mappedItems = userData.flatMap(v => {
    if (!v.timeOffsetEpochToBreaths) return undefined;
    const timeOffsetEpochToBreaths = v.timeOffsetEpochToBreaths;
    const offsets = Object.keys(timeOffsetEpochToBreaths).map(Number);
    if (offsets.length < 1) return undefined;
    return offsets.map(offset => {
      const date = secondsToISODate(v.startTimeInSeconds);
      const time = dayjs.unix(v.startTimeInSeconds + offset).toISOString();
      const value = timeOffsetEpochToBreaths[offset];
      return { date, breath: { time, value } };
    });
  });
  return mappedItems.filter(v => v != null) as BreathAndDate[];
};

export const garminRespirationSchema = z.object({
  startTimeInSeconds: garminTypes.startTime,
  // startTimeOffsetInSeconds: -21600, // always return UTC
  // durationInSeconds: garminTypes.duration.nullable().optional(), // not being used
  timeOffsetEpochToBreaths: garminTypes.timeOffsetEpochToBreaths.nullable().optional(),
});
export type GarminRespiration = z.infer<typeof garminRespirationSchema>;

export const garminRespirationWithMetaSchema = garminMetaSchema.merge(garminRespirationSchema);
export type GarminRespirationWithMeta = z.infer<typeof garminRespirationWithMetaSchema>;

export const garminRespirationListSchema = z.array(garminRespirationWithMetaSchema);
export type GarminRespirationList = z.infer<typeof garminRespirationListSchema>;
