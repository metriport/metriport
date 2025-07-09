import { processAsyncError } from "@metriport/core/util/error/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { processPatientsFromAppointments } from "../../../../external/ehr/elation/command/process-patients-from-appointments";
import {
  createOrUpdateElationPatientMetadata,
  syncElationPatientIntoMetriport,
} from "../../../../external/ehr/elation/command/sync-patient";
import { requestLogger } from "../../../helpers/request-logger";
import { getUUIDFrom } from "../../../schemas/uuid";
import { asyncHandler, getFromQueryAsBoolean, getFromQueryOrFail } from "../../../util";

const router = Router();

/**
 * POST /internal/ehr/elation/patient/appointments
 *
 * Fetches appointments in the future and creates all patients not already existing
 * @returns 200 OK
 */
router.post(
  "/appointments",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    processPatientsFromAppointments().catch(
      processAsyncError("Elation processPatientsFromAppointments")
    );
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/ehr/elation/patient
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.query.cxId The ID of Metriport Customer.
 * @param req.query.patientId The ID of Elation Patient.
 * @param req.query.practiceId The ID of Elation Practice.
 * @param req.query.triggerDq Whether to trigger a data quality check.
 * @returns 200 OK
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const elationPatientId = getFromQueryOrFail("patientId", req);
    const elationPracticeId = getFromQueryOrFail("practiceId", req);
    const triggerDq = getFromQueryAsBoolean("triggerDq", req);
    const isAppointment = getFromQueryAsBoolean("isAppointment", req);
    syncElationPatientIntoMetriport({
      cxId,
      elationPracticeId,
      elationPatientId,
      triggerDq,
      triggerDqForExistingPatient: isAppointment,
    }).catch(processAsyncError("Elation syncElationPatientIntoMetriport"));
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/ehr/elation/patient/link
 *
 * Creates or updates the Elation patient metadata
 * @param req.query.cxId The ID of Metriport Customer.
 * @param req.query.patientId The ID of Elation Patient.
 * @param req.query.practiceId The ID of Elation Practice.
 * @returns 200 OK
 */
router.post(
  "/link",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const elationPatientId = getFromQueryOrFail("patientId", req);
    const elationPracticeId = getFromQueryOrFail("practiceId", req);
    createOrUpdateElationPatientMetadata({
      cxId,
      elationPracticeId,
      elationPatientId,
    }).catch(processAsyncError("Elation createOrUpdateElationPatientMetadata"));
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
