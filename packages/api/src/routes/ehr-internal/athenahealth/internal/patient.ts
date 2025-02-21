import Router from "express-promise-router";
import { processAsyncError } from "@metriport/core/util/error/shared";
import httpStatus from "http-status";
import { Request, Response } from "express";
import {
  processPatientsFromAppointments,
  LookupMode,
} from "../../../../external/ehr/athenahealth/command/process-patients-from-appointments";
import { requestLogger } from "../../../helpers/request-logger";
import { asyncHandler, getFromQueryAsBoolean } from "../../../util";
const router = Router();

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
    processPatientsFromAppointments(
      catchUp ? LookupMode.FromSubscriptionBackfill : LookupMode.FromSubscription
    ).catch(processAsyncError("AthenaHealth processPatientsFromAppointments"));
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/ehr/athenahealth/patient/appointments-from-subscription
 *
 * Fetches appointments since last call creates all patients not already existing
 */
router.post(
  "/appointments-from-subscription",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    processPatientsFromAppointments(LookupMode.FromSubscription).catch(
      processAsyncError("AthenaHealth processPatientsFromAppointments from-subscription")
    );
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/ehr/athenahealth/patient/appointments-from-subscription-backfill
 *
 * Fetches appointments since last call creates all patients not already existing
 */
router.post(
  "/appointments-from-subscription-backfill",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    processPatientsFromAppointments(LookupMode.FromSubscriptionBackfill).catch(
      processAsyncError("AthenaHealth processPatientsFromAppointments from-subscription-backfill")
    );
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/ehr/athenahealth/patient/appointments
 *
 * Fetches appointments since last call creates all patients not already existing
 */
router.post(
  "/appointments",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    processPatientsFromAppointments(LookupMode.Appointments).catch(
      processAsyncError("AthenaHealth processPatientsFromAppointmentsSub appointments")
    );
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
