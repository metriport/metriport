import Router from "express-promise-router";
import httpStatus from "http-status";
import { Request, Response } from "express";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail } from "../../util";

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
    const cxId = getCxIdOrFail(req);
    const metriportPatient = await getPatientOrFail({
      cxId,
      id: "FILL", // Metriport Patient ID
    });
    return res.status(httpStatus.OK).json(metriportPatient.id);
  })
);

export default router;
