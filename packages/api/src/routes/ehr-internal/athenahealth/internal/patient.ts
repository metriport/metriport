import { processAsyncError } from "@metriport/core/util/error/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { processPatientsFromAppointments } from "../../../../external/ehr/athenahealth/command/process-patients-from-appointments";
import { LookupModes } from "../../../../external/ehr/athenahealth/shared";
import { requestLogger } from "../../../helpers/request-logger";
import { asyncHandler, getFromQueryAsBoolean } from "../../../util";
const router = Router();

const athenaAsyncMsg = "AthenaHealth processPatientsFromAppointments";

/**
 * POST /internal/ehr/athenahealth/patient/from-appointments-subscription
 *
 * Fetches appointments since last call creates all patients not already existing
 */
router.post(
  "/from-appointments-subscription",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const catchUp = getFromQueryAsBoolean("catchUp", req) ?? false;
    processPatientsFromAppointments({
      lookupMode: catchUp ? LookupModes.FromSubscriptionBackfill : LookupModes.FromSubscription,
    }).catch(processAsyncError(athenaAsyncMsg));
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/ehr/athenahealth/patient/appointments-from-subscription
 *
 * Fetches appointment change events since last call and creates all patients not already existing
 */
router.post(
  "/appointments-from-subscription",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    processPatientsFromAppointments({ lookupMode: LookupModes.FromSubscription }).catch(
      processAsyncError(`${athenaAsyncMsg} ${LookupModes.FromSubscription}`)
    );
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/ehr/athenahealth/patient/appointments-from-subscription-backfill
 *
 * Fetches appointment change events already processed and creates all patients not already existing
 */
router.post(
  "/appointments-from-subscription-backfill",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    processPatientsFromAppointments({ lookupMode: LookupModes.FromSubscriptionBackfill }).catch(
      processAsyncError(`${athenaAsyncMsg} ${LookupModes.FromSubscriptionBackfill}`)
    );
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/ehr/athenahealth/patient/appointments
 *
 * Fetches appointments in the future and creates all patients not already existing
 */
router.post(
  "/appointments",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    processPatientsFromAppointments({ lookupMode: LookupModes.Appointments }).catch(
      processAsyncError(`${athenaAsyncMsg} ${LookupModes.Appointments}`)
    );
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
