import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { syncHealthiePatientIntoMetriport } from "../../../external/ehr/healthie/command/sync-patient";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFrom, getFromQueryOrFail } from "../../util";
import { processEhrPatientId } from "../shared";
import { tokenEhrPatientIdQueryParam } from "./auth/middleware";

const router = Router();

/**
 * GET /ehr/healthie/patient/:id
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of Healthie Patient.
 * @param req.query.practiceId The ID of Healthie Practice.
 * @returns Metriport Patient if found.
 */
router.get(
  "/:id",
  handleParams,
  processEhrPatientId(tokenEhrPatientIdQueryParam, "params"),
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const healthiePatientId = getFrom("params").orFail("id", req);
    const healthiePracticeId = getFromQueryOrFail("practiceId", req);
    const patientId = await syncHealthiePatientIntoMetriport({
      cxId,
      healthiePracticeId,
      healthiePatientId,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

/**
 * POST /ehr/healthie/patient/:id
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of Healthie Patient.
 * @param req.query.practiceId The ID of Healthie Practice.
 * @returns Metriport Patient if found.
 */
router.post(
  "/:id",
  handleParams,
  processEhrPatientId(tokenEhrPatientIdQueryParam, "params"),
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const healthiePatientId = getFrom("params").orFail("id", req);
    const healthiePracticeId = getFromQueryOrFail("practiceId", req);
    const patientId = await syncHealthiePatientIntoMetriport({
      cxId,
      healthiePracticeId,
      healthiePatientId,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

export default router;
