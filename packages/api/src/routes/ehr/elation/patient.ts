import Router from "express-promise-router";
import httpStatus from "http-status";
import { Request, Response } from "express";
import { syncElationPatientIntoMetriport } from "../../../external/ehr/elation/command/sync-patient";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFrom, getFromQueryOrFail } from "../../util";
import { handleParams } from "../../helpers/handle-params";
import { processEhrPatientId } from "../shared";
import { tokenEhrPatientIdQueryParam } from "./auth/middleware";

const router = Router();

/**
 * GET /ehr/elation/patient/:id
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of Elation Patient.
 * @returns Metriport Patient if found.
 */
router.get(
  "/:id",
  handleParams,
  processEhrPatientId(tokenEhrPatientIdQueryParam, "params"),
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const elationPatientId = getFrom("params").orFail("id", req);
    const elationPracticeId = getFromQueryOrFail("practiceId", req);
    const patientId = await syncElationPatientIntoMetriport({
      cxId,
      elationPracticeId,
      elationPatientId,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

/**
 * POST /ehr/elation/patient/:id
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of Elation Patient.
 * @returns Metriport Patient if found.
 */
router.post(
  "/:id",
  handleParams,
  processEhrPatientId(tokenEhrPatientIdQueryParam, "params"),
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const elationPatientId = getFrom("params").orFail("id", req);
    const elationPracticeId = getFromQueryOrFail("practiceId", req);
    const patientId = await syncElationPatientIntoMetriport({
      cxId,
      elationPracticeId,
      elationPatientId,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

export default router;
