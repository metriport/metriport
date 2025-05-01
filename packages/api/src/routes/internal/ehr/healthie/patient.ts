import { processAsyncError } from "@metriport/core/util/error/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { processPatientsFromAppointments } from "../../../../external/ehr/healthie/command/process-patients-from-appointments";
import { syncHealthiePatientIntoMetriport } from "../../../../external/ehr/healthie/command/sync-patient";
import { requestLogger } from "../../../helpers/request-logger";
import { getUUIDFrom } from "../../../schemas/uuid";
import { asyncHandler, getFromQueryAsBoolean, getFromQueryOrFail } from "../../../util";
import { updateHealthiePatientQuickNotes } from "../../../../external/ehr/healthie/command/sync-patient";
import { LookupModes } from "../../../../external/ehr/healthie/shared";

const router = Router();

/**
 * POST /internal/ehr/healthie/patient/appointments
 *
 * Fetches appointments in the future and creates all patients not already existing
 * @returns 200 OK
 */
router.post(
  "/appointments",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    processPatientsFromAppointments({ lookupMode: LookupModes.Appointments }).catch(
      processAsyncError("Healthie processPatientsFromAppointments")
    );
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/ehr/healthie/patient/appointments-48hr
 *
 * Fetches appointments in 48 hours and creates all patients not already existing
 * @returns 200 OK
 */
router.post(
  "/appointments-48hr",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    processPatientsFromAppointments({ lookupMode: LookupModes.Appointments48hr }).catch(
      processAsyncError("Healthie processPatientsFromAppointments")
    );
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/ehr/healthie/patient
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.query.cxId The ID of Metriport Customer.
 * @param req.query.patientId The ID of Healthie Patient.
 * @param req.query.practiceId The ID of Healthie Practice.
 * @param req.query.triggerDq Whether to trigger a data quality check.
 * @returns 200 OK
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const healthiePatientId = getFromQueryOrFail("patientId", req);
    const healthiePracticeId = getFromQueryOrFail("practiceId", req);
    const triggerDq = getFromQueryAsBoolean("triggerDq", req);
    syncHealthiePatientIntoMetriport({
      cxId,
      healthiePracticeId,
      healthiePatientId,
      triggerDq,
    }).catch(processAsyncError("Healthie syncHealthiePatientIntoMetriport"));
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/ehr/healthie/patient/link
 *
 * Creates or updates the Healthie patient metadata
 * @param req.query.cxId The ID of Metriport Customer.
 * @param req.query.patientId The ID of Healthie Patient.
 * @param req.query.practiceId The ID of Healthie Practice.
 * @returns 200 OK
 */
router.post(
  "/link",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const healthiePatientId = getFromQueryOrFail("patientId", req);
    const healthiePracticeId = getFromQueryOrFail("practiceId", req);
    updateHealthiePatientQuickNotes({
      cxId,
      healthiePracticeId,
      healthiePatientId,
    }).catch(processAsyncError("Healthie updateHealthiePatientQuickNotes"));
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
