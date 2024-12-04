import Router from "express-promise-router";
import httpStatus from "http-status";
import { Request, Response } from "express";
import { processPatientsFromAppointments } from "../../../../external/ehr/elation/command/process-patients-from-appointments";
import { requestLogger } from "../../../helpers/request-logger";
import { asyncHandler } from "../../../util";
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
    processPatientsFromAppointments();
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
