import { processAsyncError } from "@metriport/core/util/error/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { processPatientsFromAppointmentsSub } from "../../../../external/ehr/athenahealth/command/process-patients-from-appointments-sub";
import { syncAthenaPatientIntoMetriport } from "../../../../external/ehr/athenahealth/command/sync-patient";
import { requestLogger } from "../../../helpers/request-logger";
import { getUUIDFrom } from "../../../schemas/uuid";
import { asyncHandler, getFrom, getFromQueryAsBoolean, getFromQueryOrFail } from "../../../util";

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
    processPatientsFromAppointmentsSub({ catchUp }).catch(
      processAsyncError("AthenaHealth processPatientsFromAppointmentsSub")
    );
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * GET /internal/ehr/athenahealth/patient/:id
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of AthenaHealth Patient.
 * @returns Metriport Patient if found.
 */
router.get(
  "/:id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const athenaPatientId = getFrom("params").orFail("id", req);
    const athenaPracticeId = getFromQueryOrFail("practiceId", req);
    const patientId = await syncAthenaPatientIntoMetriport({
      cxId,
      athenaPracticeId,
      athenaPatientId,
      triggerDq: true,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

export default router;
