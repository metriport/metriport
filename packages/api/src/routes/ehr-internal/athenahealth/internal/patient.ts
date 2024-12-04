import Router from "express-promise-router";
import httpStatus from "http-status";
import { Request, Response } from "express";
import { processPatientsFromAppointmentsSub } from "../../../../external/ehr/athenahealth/command/process-patients-from-appointments-sub";
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
    processPatientsFromAppointmentsSub({ catchUp });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
