import { processAsyncError } from "@metriport/core/util/error/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { processPatientsFromAppointments } from "../../../../external/ehr/canvas/command/process-patients-from-appointments";
import { requestLogger } from "../../../helpers/request-logger";
import { asyncHandler } from "../../../util";
const router = Router();

/**
 * POST /internal/ehr/canvas/patient/appointments
 *
 * Fetches appointments in the time range and creates all patients not already existing
 */
router.post(
  "/appointments",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    processPatientsFromAppointments().catch(
      processAsyncError("Canvas processPatientsFromAppointments")
    );
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
