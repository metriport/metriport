import { processAsyncError } from "@metriport/core/util/error/shared";
import { catchUpOrBackFillSchema } from "@metriport/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { processPatientsFromAppointments } from "../../../../external/ehr/athenahealth/command/process-patients-from-appointments";
import { requestLogger } from "../../../helpers/request-logger";
import { asyncHandler, getFromQuery, getFromQueryAsBoolean } from "../../../util";
const router = Router();

/* TODO Remove as part of 2188 Canvas PR
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
    processPatientsFromAppointments(catchUp ? "catchUp" : undefined).catch(
      processAsyncError("AthenaHealth processPatientsFromAppointments")
    );
    return res.sendStatus(httpStatus.OK);
  })
);

router.post(
  "/from-appointments",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const catchUpOrBackfillQuery = getFromQuery("catchUpOrBackfill", req);
    const catchUpOrBackFill = catchUpOrBackFillSchema.parse(catchUpOrBackfillQuery);
    processPatientsFromAppointments(catchUpOrBackFill).catch(
      processAsyncError("AthenaHealth processPatientsFromAppointments")
    );
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
