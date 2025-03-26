import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { syncCanvasPatientIntoMetriport } from "../../../external/ehr/canvas/command/sync-patient";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFrom, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * GET /ehr/canvas/patient/:id
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of Canvas Patient.
 * @returns Metriport Patient if found.
 */
router.get(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const canvasPatientId = getFrom("params").orFail("id", req);
    const canvasPracticeId = getFromQueryOrFail("practiceId", req);
    const patientId = await syncCanvasPatientIntoMetriport({
      cxId,
      canvasPracticeId,
      canvasPatientId,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

/**
 * POST /ehr/canvas/patient/:id
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of Canvas Patient.
 * @returns Metriport Patient if found.
 */
router.post(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const canvasPatientId = getFrom("params").orFail("id", req);
    const canvasPracticeId = getFromQueryOrFail("practiceId", req);
    const patientId = await syncCanvasPatientIntoMetriport({
      cxId,
      canvasPracticeId,
      canvasPatientId,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

export default router;
