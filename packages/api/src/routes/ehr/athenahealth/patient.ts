import Router from "express-promise-router";
import httpStatus from "http-status";
import { Request, Response } from "express";
import { getPatientIdOrFail as getPatientIdFromAthenaPatientOrFail } from "../../../external/ehr/athenahealth/command/get-patient";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFrom } from "../../util";
import { getAuthorizationToken } from "../../util";

const router = Router();

/**
 * GET /ehr/athenahealth/patient/:id
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of AthenaHealth Patient.
 * @returns Metriport Patient if found.
 */
router.get(
  "/:id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const accessToken = getAuthorizationToken(req);
    const cxId = getCxIdOrFail(req);
    const athenaPatientId = getFrom("params").orFail("id", req);
    const patientId = await getPatientIdFromAthenaPatientOrFail({
      accessToken,
      cxId,
      athenaPatientId,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

export default router;
