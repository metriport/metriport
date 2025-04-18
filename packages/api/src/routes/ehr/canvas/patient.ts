import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { fetchCanvasMetriportOnlyBundle } from "../../../external/ehr/canvas/command/bundle/fetch-metriport-only-bundle";
import { getCanvasResourceDiff } from "../../../external/ehr/canvas/command/resource-diff/get-resource-diff";
import { getLatestCanvasResourceDiff } from "../../../external/ehr/canvas/command/resource-diff/get-resource-diff-latest";
import { startCanvasResourceDiff } from "../../../external/ehr/canvas/command/resource-diff/start-resource-diff";
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

/**
 * POST /ehr/canvas/patient/:id/resource-diff
 *
 * Starts the resource diff process
 * @param req.params.id The ID of Canvas Patient.
 * @returns 200 OK
 */
router.post(
  "/:id/resource-diff",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const canvasPatientId = getFrom("params").orFail("id", req);
    const canvasPracticeId = getFromQueryOrFail("practiceId", req);
    const requestId = await startCanvasResourceDiff({ cxId, canvasPatientId, canvasPracticeId });
    return res.status(httpStatus.OK).json(requestId);
  })
);

/**
 * GET /ehr/canvas/patient/:id/resource-diff
 *
 * Retrieves the resource diff workflow
 * @param req.params.id The ID of Canvas Patient.
 * @returns Resource diff workflow
 */
router.get(
  "/:id/resource-diff",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const canvasPatientId = getFrom("params").orFail("id", req);
    const requestId = getFromQueryOrFail("requestId", req);
    const workflow = await getCanvasResourceDiff({ cxId, canvasPatientId, requestId });
    return res.status(httpStatus.OK).json(workflow);
  })
);

/**
 * GET /ehr/canvas/patient/:id/latest-resource-diff
 *
 * Retrieves the latest resource diff workflow
 * @param req.params.id The ID of Canvas Patient.
 * @returns Resource diff workflow
 */
router.get(
  "/:id/latest-resource-diff",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const canvasPatientId = getFrom("params").orFail("id", req);
    const workflow = await getLatestCanvasResourceDiff({ cxId, canvasPatientId });
    return res.status(httpStatus.OK).json(workflow);
  })
);

/**
 * GET /ehr/canvas/patient/:id/metriport-only-bundle
 *
 * Retrieves the metriport only bundle
 * @param req.params.id The ID of Canvas Patient.
 * @returns Metriport only bundle
 */
router.get(
  "/:id/metriport-only-bundle",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const canvasPatientId = getFrom("params").orFail("id", req);
    const canvasPracticeId = getFromQueryOrFail("practiceId", req);
    const bundle = await fetchCanvasMetriportOnlyBundle({
      cxId,
      canvasPatientId,
      canvasPracticeId,
    });
    return res.status(httpStatus.OK).json(bundle);
  })
);

export default router;
