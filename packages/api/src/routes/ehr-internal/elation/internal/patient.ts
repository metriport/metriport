import { processAsyncError } from "@metriport/core/util/error/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { getUUIDFrom } from "../../../schemas/uuid";
import { syncElationPatientIntoMetriport } from "../../../../external/ehr/elation/command/sync-patient";
import { processPatientsFromAppointments } from "../../../../external/ehr/elation/command/process-patients-from-appointments";
import { requestLogger } from "../../../helpers/request-logger";
import { asyncHandler, getFrom, getFromQueryOrFail } from "../../../util";

const router = Router();

/**
 * POST /internal/ehr/elation/patient/from-appointments
 *
 * Fetches appointments in the time range and creates all patients not already existing
 */
router.post(
  "/from-appointments",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    processPatientsFromAppointments().catch(
      processAsyncError("Elation processPatientsFromAppointments")
    );
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * GET /internal/ehr/elation/patient/:id
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of Elation Patient.
 * @returns Metriport Patient if found.
 */
router.get(
  "/:id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const elationPatientId = getFrom("params").orFail("id", req);
    const elationPracticeId = getFromQueryOrFail("practiceId", req);
    const patientId = await syncElationPatientIntoMetriport({
      cxId,
      elationPracticeId,
      elationPatientId,
      triggerDq: true,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

export default router;
