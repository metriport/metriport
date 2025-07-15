import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { mapPatient } from "../../command/medical/patient/map-patient";
import { requestLogger } from "../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFromParamsOrFail, getFromQuery } from "../util";

const router = Router();

/** ---------------------------------------------------------------------------
 * POST /mapping/patient/:patientId/map
 *
 * Maps a metriport patient to a patient in an external mapping system.
 *
 * @param req.query.mappingId The ID of the mapping to use. Optional.
 * @returns The Metriport patient ID and the mapping patient ID.
 * @throws 400 if the patient has no external ID to attempt mapping
 * @throws 400 if the mapping source is not supported
 * @throws 404 if no mapping is found
 */
router.post(
  "/patient/:patientId/map",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFromParamsOrFail("patientId", req);
    const cxMappingId = getFromQuery("mappingId", req);

    const { metriportPatientId, mappingPatientId } = await mapPatient({
      cxId,
      patientId,
      cxMappingId,
    });

    return res.status(status.OK).json({ metriportPatientId, mappingPatientId });
  })
);

export default router;
