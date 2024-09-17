import Router from "express-promise-router";
import httpStatus from "http-status";
import { Request, Response } from "express";
import { writeMedicationToChart } from "../../../external/ehr/athenahealth/command/write-to-chart";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFrom, getFromQueryOrFail } from "../../util";
import { getAuthorizationToken } from "../../util";

const router = Router();

/**
 * PUT /ehr/athenahealth/chart/:id/medication
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.body The FHIR Resource payload
 * @returns Metriport Patient if found.
 */
router.put(
  "/:id/medication",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const accessToken = getAuthorizationToken(req);
    const cxId = getCxIdOrFail(req);
    const athenaPatientId = getFrom("params").orFail("id", req);
    const athenaPracticeId = getFromQueryOrFail("practiceId", req);
    const payload = req.body;
    const patientId = await writeMedicationToChart({
      accessToken,
      cxId,
      athenaPatientId,
      athenaPracticeId,
      medication: payload,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

export default router;
