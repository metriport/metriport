import { processAsyncError } from "@metriport/core/util/error/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { processPatientsFromAppointments } from "../../../../external/ehr/athenahealth/command/process-patients-from-appointments";
import { syncAthenaPatientIntoMetriport } from "../../../../external/ehr/athenahealth/command/sync-patient";
import { LookupModes } from "../../../../external/ehr/athenahealth/shared";
import { requestLogger } from "../../../helpers/request-logger";
import { getUUIDFrom } from "../../../schemas/uuid";
import { asyncHandler, getFromQueryAsBoolean, getFromQueryOrFail } from "../../../util";

const router = Router();

const athenaAsyncMsg = "AthenaHealth processPatientsFromAppointments";

/**
 * POST /internal/ehr/athenahealth/patient/appointments-from-subscription
 *
 * Fetches appointment change events since last call and creates all patients not already existing
 * @returns 200 OK
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
 * @returns 200 OK
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
 * @returns 200 OK
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

/**
 * POST /internal/ehr/athenahealth/patient
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of AthenaHealth Patient.
 * @returns 200 OK
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const athenaPatientId = getFromQueryOrFail("patientId", req);
    const athenaPracticeId = getFromQueryOrFail("practiceId", req);
    const athenaDepartmentId = getFromQueryOrFail("departmentId", req);
    const triggerDq = getFromQueryAsBoolean("triggerDq", req);
    syncAthenaPatientIntoMetriport({
      cxId,
      athenaPracticeId,
      athenaPatientId,
      athenaDepartmentId,
      triggerDq,
    }).catch(processAsyncError("AthenaHealth syncAthenaPatientIntoMetriport"));
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
