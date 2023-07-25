import { Activity } from "@metriport/api-sdk";
import { groupBy, partition } from "lodash";
import { z } from "zod";
import { garminMetaSchema, User, UserData } from ".";
import { Util } from "../../shared/util";
import { garminActivitySummarySchema, garminActivitySummaryToActivityLog } from "./activity";

const log = Util.log("[Garmin.activityDetails]");

export const mapToActivity = (activities: GarminActivityDetail[]): UserData<Activity>[] => {
  const type = "activity";
  // The current version does not supported composite activities - ie. MULTI_SPORT
  const [activitiesToProcess, doNotProcess] = partition(
    activities,
    a => !a.summary.parentSummaryId
  );
  if (doNotProcess.length > 0) {
    log(`Skipping ${doNotProcess.length} MULTI_SPORT activities`);
  }
  const byUAT = groupBy(activitiesToProcess, a => a.userAccessToken);
  return Object.entries(byUAT).flatMap(([key, values]) => {
    const uat = key;
    const userData = values;
    const user: User = {
      userAccessToken: uat,
    };
    return userData
      .map(a => a.summary)
      .map(garminActivitySummaryToActivityLog)
      .map(data => ({ user, typedData: { type, data } }));
  });
};

export const garminActivityDetailSchema = garminMetaSchema.extend({
  summary: garminActivitySummarySchema,
});
export type GarminActivityDetail = z.infer<typeof garminActivityDetailSchema>;

export const garminActivityDetailListSchema = z.array(garminActivityDetailSchema);
export type GarminActivityDetailList = z.infer<typeof garminActivityDetailListSchema>;
