import { MetriportData } from "@metriport/api-sdk/devices/models/metriport-data";
import { Request, Response } from "express";
import Router from "express-promise-router";
import { processData } from "../../command/webhook/garmin";
import { processAsyncError } from "../../errors";
import { UserData } from "../../mappings/garmin";
import { garminActivityListSchema, mapToActivity } from "../../mappings/garmin/activity";
import {
  garminActivityDetailListSchema,
  mapToActivity as mapToActivityDetail,
} from "../../mappings/garmin/activity-detail";
import {
  garminBloodPressureListSchema,
  mapToBiometricsFromBloodPressure,
} from "../../mappings/garmin/bloodPressure";
import { garminBodyCompositionListSchema, mapToBody } from "../../mappings/garmin/body-composition";
import { garminHRVListSchema, mapToBiometricsFromHRV } from "../../mappings/garmin/hrv";
import {
  garminRespirationListSchema,
  mapToBiometricsFromRespiration,
} from "../../mappings/garmin/respiration";
import { garminSleepListSchema, mapToSleep } from "../../mappings/garmin/sleep";
import { garminUserMetricsListSchema, mapToBiometricsFromUser } from "../../mappings/garmin/user";
import { Util } from "../../shared/util";
import { deregister, deregisterUsersSchema } from "../middlewares/oauth1";
import { asyncHandler } from "../util";

const routes = Router();

const { log, debug } = Util.out(`GARMIN.Webhook`);

// TODO #34 #118 Finish and document
/** ---------------------------------------------------------------------------
 * POST /
 *
 * WEBHOOK CALL
 */
routes.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    logRequest(req);

    // USER/AUTH related
    if (req.body.deregistrations) {
      await deregister(deregisterUsersSchema.parse(req.body.deregistrations));
    }
    // CONVERT
    const data = mapData(req.body);
    if (!data) {
      console.log(`Data mapping is empty, returning 200`);
      return res.sendStatus(200);
    }
    // STORE AND SEND TO CUSTOMER
    // Intentionally asynchronous, respond asap, sending to customers is irrelevant to Provider
    processData(data).catch(processAsyncError(`wh.garmin.processData`));

    return res.sendStatus(200);
  })
);

//eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapData(body: any): UserData<MetriportData>[] | undefined {
  const results: UserData<MetriportData>[] = [];

  if (body.activities) {
    results.push(...mapToActivity(garminActivityListSchema.parse(body.activities)));
  }
  if (body.activityDetails) {
    results.push(
      ...mapToActivityDetail(garminActivityDetailListSchema.parse(body.activityDetails))
    );
  }
  if (body.sleeps) {
    results.push(...mapToSleep(garminSleepListSchema.parse(body.sleeps)));
  }
  if (body.bodyComps) {
    results.push(...mapToBody(garminBodyCompositionListSchema.parse(body.bodyComps)));
  }
  if (body.userMetrics) {
    results.push(...mapToBiometricsFromUser(garminUserMetricsListSchema.parse(body.userMetrics)));
  }
  if (body.hrv) {
    results.push(...mapToBiometricsFromHRV(garminHRVListSchema.parse(body.hrv)));
  }
  if (body.bloodPressures) {
    results.push(
      ...mapToBiometricsFromBloodPressure(garminBloodPressureListSchema.parse(body.bloodPressures))
    );
  }
  if (body.allDayRespiration) {
    results.push(
      ...mapToBiometricsFromRespiration(garminRespirationListSchema.parse(body.allDayRespiration))
    );
  }

  if (!results || results.length < 1) {
    const msg = "Could not process the payload";
    log(msg + ": " + JSON.stringify(body));
    // failing silently for unexpected payloads
    return undefined;
  }
  return results;
}

function logRequest(req: Request): void {
  debug(`Headers: ${JSON.stringify(req.headers)}`);
  debug(`Query: ${JSON.stringify(req.query)}`);
  debug(`BODY: ${JSON.stringify(req.body)}`);
}

export default routes;
