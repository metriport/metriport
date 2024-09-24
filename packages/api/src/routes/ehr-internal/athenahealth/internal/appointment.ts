import Router from "express-promise-router";
import httpStatus from "http-status";
import { Request, Response } from "express";
import { getAthenaAppointments } from "../../../../external/ehr/athenahealth/command/get-appointments";
import { requestLogger } from "../../../helpers/request-logger";
import { asyncHandler } from "../../../util";
const router = Router();

/**
 * POST /internal/ehr/athenahealth/appointment/list
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of AthenaHealth Patient.
 * @param req.body The FHIR Resource payload
 * @returns Metriport Patient if found.
 */
router.get(
  "/list",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    getAthenaAppointments();
    return res.status(httpStatus.OK);
  })
);

export default router;
