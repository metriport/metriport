import Router from "express-promise-router";
import httpStatus from "http-status";
import { Request, Response } from "express";
import { syncAthenaPatientIntoMetriport } from "../../../external/ehr/athenahealth/command/sync-patient";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFrom, getFromQueryOrFail } from "../../util";
import { getAuthorizationToken } from "../../util";
import { handleParams } from "../../helpers/handle-params";

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
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const accessToken = getAuthorizationToken(req);
    const cxId = getCxIdOrFail(req);
    const athenaPatientId = getFrom("params").orFail("id", req);
    const athenaPracticeId = getFromQueryOrFail("practiceId", req);
    const patientId = await syncAthenaPatientIntoMetriport({
      cxId,
      athenaPracticeId,
      athenaPatientId,
      accessToken,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

export default router;
