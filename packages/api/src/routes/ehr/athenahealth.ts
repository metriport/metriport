import Router from "express-promise-router";
import httpStatus from "http-status";
import { Request, Response } from "express";
import { getPatient } from "../../external/athenahealth/command/get-patient";
import { requestLogger } from "../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFrom } from "../util";

const router = Router();

/**
 * GET /ehr/athena/patient/:id
 *
 * Retrieves the organization with the specified OID from CommonWell.
 * @param req.params.oid The OID of the organization to retrieve.
 * @returns Returns the organization with the specified OID.
 */
router.get(
  "/patient/:id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const accessToken = req.headers.Authorization;
    if (!accessToken) throw new Error("Missing Authorization Header");
    if (Array.isArray(accessToken)) throw new Error("Malformed Authorization Header");
    const patientId = getFrom("params").orFail("id", req);
    const patient = await getPatient({
      accessToken,
      cxId,
      patientId,
    });
    return res.status(httpStatus.OK).json(patient);
  })
);

export default router;
