import { Biometrics } from "@metriport/api-sdk";
import { groupBy } from "lodash";
import { z } from "zod";
import { garminMetaSchema, garminTypes, User, UserData } from ".";
import { PROVIDER_GARMIN } from "../../shared/constants";

export const mapToBiometricsFromUser = (items: GarminUserMetricsList): UserData<Biometrics>[] => {
  const type = "biometrics";
  const itemsByUAT = groupBy(items, a => a.userAccessToken);
  return Object.entries(itemsByUAT).flatMap(([key, values]) => {
    const uat = key;
    const userData = values;
    const user: User = {
      userAccessToken: uat,
    };
    const mappedItems = userData.map(garminUserMetricsToBody);
    const definedItems: Biometrics[] = mappedItems.filter(
      (v: Biometrics | undefined) => v != undefined
    ) as Biometrics[];
    return definedItems.map(data => ({
      user,
      typedData: { type, data },
    }));
  });
};

export const garminUserMetricsToBody = (gBody: GarminUserMetrics): Biometrics | undefined => {
  const bio: Biometrics = {
    metadata: {
      date: gBody.calendarDate,
      source: PROVIDER_GARMIN,
    },
  };
  if (gBody.vo2Max != null) {
    bio.respiration = {
      vo2_max: gBody.vo2Max,
    };
    return bio;
  }
  return undefined;
};

export const garminUserMetricsSchema = z.object({
  calendarDate: garminTypes.date,
  vo2Max: garminTypes.vo2Max.nullish(),
  // fitnessAge: 44, // we don't have this
});
export type GarminUserMetrics = z.infer<typeof garminUserMetricsSchema>;

export const garminUserMetricsWithMetaSchema = garminMetaSchema.merge(garminUserMetricsSchema);
export type GarminUserMetricsWithMeta = z.infer<typeof garminUserMetricsWithMetaSchema>;

export const garminUserMetricsListSchema = z.array(garminUserMetricsWithMetaSchema);
export type GarminUserMetricsList = z.infer<typeof garminUserMetricsListSchema>;
