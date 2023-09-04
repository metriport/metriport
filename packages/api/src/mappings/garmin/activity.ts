import { Activity } from "@metriport/api-sdk";
import { ActivityLog } from "@metriport/api-sdk/devices/models/common/activity-log";
import { ActivityMovement } from "@metriport/api-sdk/devices/models/common/activity-movement";
import { EnergyExpenditure } from "@metriport/api-sdk/devices/models/common/energy-expenditure";
import { HeartRate } from "@metriport/api-sdk/devices/models/common/heart-rate";
import { groupBy, partition } from "lodash";
import { z } from "zod";
import { garminMetaSchema, User, UserData } from ".";
import { PROVIDER_GARMIN } from "../../shared/constants";
import { secondsToISODate, secondsToISODateTime } from "../../shared/date";
import { Util } from "../../shared/util";
import { activityTypeReadable } from "./activity-types";

const log = Util.log("[Garmin.activity]");

export const activeKCalToEnergy = (active_kcal: number): EnergyExpenditure => ({
  active_kcal,
});

export const activityToMovement = (
  activity: GarminActivitySummary
): ActivityMovement | undefined => {
  const res: ActivityMovement = {
    steps_count: Util.optional(activity.steps),
    avg_cadence: Util.oneOf(
      activity.averageBikeCadenceInRoundsPerMinute,
      activity.averageRunCadenceInStepsPerMinute,
      activity.averageSwimCadenceInStrokesPerMinute
    ),
    distance_meters: Util.optional(activity.distanceInMeters),
  };
  if (activity.totalElevationGainInMeters) {
    res.elevation = { gain_meters: activity.totalElevationGainInMeters };
  }
  if (activity.maxSpeedInMetersPerSecond || activity.averageSpeedInMetersPerSecond) {
    res.speed = {
      max_km_h: Util.optional(activity.maxSpeedInMetersPerSecond),
      avg_km_h: Util.optional(activity.averageSpeedInMetersPerSecond),
    };
  }
  return Object.keys(res).length > 0 ? res : undefined;
};

export const activityToLocation = (
  activity: GarminActivitySummary
): ActivityLog["location"] | undefined => {
  if (activity.startingLatitudeInDegree != null && activity.startingLongitudeInDegree != null) {
    return {
      start_lat_lon_deg: {
        lat: activity.startingLatitudeInDegree,
        lon: activity.startingLongitudeInDegree,
      },
    };
  }
  return undefined;
};

export const activityToBiometrics = (
  activity: GarminActivitySummary
): ActivityLog["biometrics"] | undefined => {
  const hearRate: HeartRate = {
    avg_bpm: Util.optional(activity.averageHeartRateInBeatsPerMinute),
    max_bpm: Util.optional(activity.maxHeartRateInBeatsPerMinute),
  };
  return Object.keys(hearRate).length > 0 ? { heart_rate: hearRate } : undefined;
};

export const mapToActivity = (activities: GarminActivity[]): UserData<Activity>[] => {
  const type = "activity";
  // The current version does not supported composite activities - ie. MULTI_SPORT
  const [activitiesToProcess, doNotProcess] = partition(activities, a => !a.parentSummaryId);
  if (doNotProcess.length > 0) {
    log(`Skipping ${doNotProcess.length} MULTI_SPORT activities`);
  }
  const byUser = groupBy(activitiesToProcess, a => a.userAccessToken);
  return Object.entries(byUser).flatMap(([key, values]) => {
    const uat = key;
    const userData = values;
    const user: User = {
      userAccessToken: uat,
    };
    return userData
      .map(garminActivitySummaryToActivityLog)
      .map(data => ({ user, typedData: { type, data } }));
  });
};

export const garminActivitySummaryToActivityLog = (
  activity: GarminActivitySummary
): ActivityLog => {
  const res: ActivityLog = {
    metadata: {
      date: secondsToISODate(activity.startTimeInSeconds),
      source: PROVIDER_GARMIN,
    },
  };
  if (activity.activityName) {
    res.name = activity.activityName;
  }
  if (activity.activityType) {
    res.type = activityTypeReadable(activity.activityType);
  }
  if (activity.startTimeInSeconds != null) {
    res.start_time = secondsToISODateTime(activity.startTimeInSeconds);
  }
  if (activity.startTimeInSeconds != null && activity.durationInSeconds != null) {
    res.end_time = secondsToISODateTime(activity.startTimeInSeconds + activity.durationInSeconds);
  }
  // durations: ActivityDurations, // nothing from Garmin's Activity Details, comes from Health API
  if (activity.activeKilocalories != null) {
    res.energy_expenditure = activeKCalToEnergy(activity.activeKilocalories);
  }
  res.movement = activityToMovement(activity);
  res.location = activityToLocation(activity);
  res.biometrics = activityToBiometrics(activity);
  return res;
};

export const garminActivitySummarySchema = z.object({
  activityId: z.number().nullable().optional(),
  activityName: z.string().nullable().optional(),
  // activityDescription: "Walk in Olathe", // missing
  durationInSeconds: z.number().nullable().optional(),
  startTimeInSeconds: z.number(),
  // startTimeOffsetInSeconds: -21600, // always return UTC
  activityType: z.string(),
  averageBikeCadenceInRoundsPerMinute: z.number().nullable().optional(),
  averageHeartRateInBeatsPerMinute: z.number().nullable().optional(),
  averageRunCadenceInStepsPerMinute: z.number().nullable().optional(),
  averageSpeedInMetersPerSecond: z.number().nullable().optional(),
  averageSwimCadenceInStrokesPerMinute: z.number().nullable().optional(),
  // averagePaceInMinutesPerKilometer: z.number().nullable().optional(), // missing
  activeKilocalories: z.number().nullable().optional(),
  // deviceName: z.string().nullable().optional(), // missing
  distanceInMeters: z.number().nullable().optional(),
  // maxBikeCadenceInRoundsPerMinute: z.number().nullable().optional(), // missing
  maxHeartRateInBeatsPerMinute: z.number().nullable().optional(),
  // maxPaceInMinutesPerKilometer: z.number().nullable().optional(), // missing
  // maxRunCadenceInStepsPerMinute: z.number().nullable().optional(), // missing
  maxSpeedInMetersPerSecond: z.number().nullable().optional(),
  // numberOfActiveLengths: z.number().nullable().optional(), ???
  startingLatitudeInDegree: z.number().nullable().optional(),
  startingLongitudeInDegree: z.number().nullable().optional(),
  steps: z.number().nullable().optional(),
  totalElevationGainInMeters: z.number().nullable().optional(),
  // totalElevationLossInMeters: z.number().nullable().optional(), // missing
  // isParent: z.boolean().nullable().optional(), // not supported for now, next version
  parentSummaryId: z.string().nullable().optional(),
  Manual: z.boolean().nullable().optional(),
  // samples // not supported
  // laps // not supported
});
export type GarminActivitySummary = z.infer<typeof garminActivitySummarySchema>;

export const garminActivitySchema = garminMetaSchema.merge(garminActivitySummarySchema);
export type GarminActivity = z.infer<typeof garminActivitySchema>;

export const garminActivityListSchema = z.array(garminActivitySchema);
export type GarminActivityList = z.infer<typeof garminActivityListSchema>;
