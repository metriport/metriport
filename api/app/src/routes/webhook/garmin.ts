import { MetriportData } from "@metriport/api/lib/models/metriport-data";
import { Request, Response } from "express";
import Router from "express-promise-router";
import { UserData } from "../../mappings/garmin";
import {
  garminActivityListSchema,
  mapToActivity,
} from "../../mappings/garmin/activity";
import {
  garminActivityDetailListSchema,
  mapToActivity as mapToActivityDetail,
} from "../../mappings/garmin/activity-detail";
import {
  garminSleepListSchema,
  mapToSleeps,
} from "../../mappings/garmin/sleep";
import { Util } from "../../shared/util";
import { processData } from "../../webhook";
import { deregister, deregisterUsersSchema } from "../middlewares/oauth1";
import { asyncHandler } from "../util";

const routes = Router();

const log = Util.log(`GARMIN.Webhook`);

// TODO #34 Finish
/** ---------------------------------------------------------------------------
 * POST /
 *
 * WEBHOOK CALL
 */
routes.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    /*
    Headers: {
      "host": "0fef-24-77-142-42.ngrok.io",
      "user-agent": "Garmin Health API",
      "content-length": "4621",
      "accept": "text/plain, application/json, application/*+json, * /*",
      "accept-encoding": "gzip,deflate",
      "content-type": "application/json;charset=UTF-8",
      "x-forwarded-for": "204.77.163.244",
      "x-forwarded-proto": "https"
    }
    Query: {}
    */
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

    /*
      TODO #34 in theory we should either process the whole payload or none, so Garmin sends it again...
      ...or we could store what we get from them in a dedicated table, so we don't reprocess it in
      case there was a partial processing.
      This would be a diff table than the outbound webhook one, where we want to have a record per chunk
      of data we're about to send to our customers.
    */
    // STORE AND SEND TO CUSTOMER
    // Intentionally asynchronous, respond asap, sending to customers is irrelevant to Provider
    processData(data);

    return res.sendStatus(200);
  })
);

function mapData(body: any): UserData<MetriportData>[] | undefined {
  const results: UserData<MetriportData>[] = [];

  if (body.activities) {
    results.push(
      ...mapToActivity(garminActivityListSchema.parse(body.activities))
    );
  }
  if (body.activityDetails) {
    results.push(
      ...mapToActivityDetail(
        garminActivityDetailListSchema.parse(body.activityDetails)
      )
    );
  }
  if (body.sleeps) {
    results.push(...mapToSleeps(garminSleepListSchema.parse(body.sleeps)));
  }

  // console.log("################### RESULT ###################");
  // console.log(JSON.stringify(results, undefined, 2));
  // TODO #34 processs other types of payload - can it have more than one type on body?
  // TODO #34 processs other types of payload - can it have more than one type on body?
  // TODO #34 processs other types of payload - can it have more than one type on body?
  if (!results || results.length < 1) {
    const msg = "Could not process the payload";
    log(msg + ": " + JSON.stringify(body));
    // failing silently for unexpected payloads
    return undefined;
  }
  console.log("################### CONVERSION SUCCESSFUL ###################");
  return results;
}

function logRequest(req: Request): void {
  log(`Headers: ${JSON.stringify(req.headers, undefined, 2)}`);
  log(`Query: ${JSON.stringify(req.query, undefined, 2)}`);
  log(`BODY: ${JSON.stringify(req.body, undefined, 2)}`);
}

export default routes;
