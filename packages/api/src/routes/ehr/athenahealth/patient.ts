import Router from "express-promise-router";
import httpStatus from "http-status";
import { Request, Response } from "express";
import { getPatient } from "../../../external/ehr/athenahealth/command/get-patient";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFrom } from "../../util";
import { getAuthorizationToken } from "../../util";

const router = Router();

/**
 * GET /ehr/athena/patient/:id
 *
 * Retrieves the organization with the specified OID from CommonWell.
 * @param req.params.oid The OID of the organization to retrieve.
 * @returns Returns the organization with the specified OID.
 */
router.get(
  "/:id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const accessToken = getAuthorizationToken(req);
    const cxId = getCxIdOrFail(req);
    const athenaPatientId = getFrom("params").orFail("id", req);
    const patient = await getPatient({
      accessToken,
      cxId,
      athenaPatientId,
    });
    return res.status(httpStatus.OK).json(patient);
  })
);

export default router;
