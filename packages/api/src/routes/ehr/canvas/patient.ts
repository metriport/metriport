import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
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
 * @param req.query.practiceId The ID of Canvas Practice.
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
 * @param req.query.practiceId The ID of Canvas Practice.
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
 * POST /ehr/canvas/patient/:id/metriport-only-bundle
 *
 * Starts the resource diff workflow to generate the Metriport only bundle.
 * The workflow is started asynchronously and requestId is returned.
 * @param req.params.id The ID of Canvas Patient.
 * @param req.query.practiceId The ID of Canvas Practice.
 * @returns the requestId of the workflow
 */
router.post(
  "/:id/metriport-only-bundle",
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
 * GET /ehr/canvas/patient/:id/metriport-only-bundle/:requestId
 *
 * Retrieves the resource diff workflow workflow and Metriport only bundle if completed
 * @param req.params.id The ID of Canvas Patient.
 * @param req.params.requestId The request ID of the workflow
 * @param req.query.practiceId The ID of Canvas Practice.
 * @returns Resource diff workflow and Metriport only bundle if completed
 */
router.get(
  "/:id/metriport-only-bundle/:requestId",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const canvasPatientId = getFrom("params").orFail("id", req);
    const canvasPracticeId = getFromQueryOrFail("practiceId", req);
    const requestId = getFrom("params").orFail("requestId", req);
    const workflowAndBundle = await getCanvasResourceDiff({
      cxId,
      canvasPatientId,
      canvasPracticeId,
      requestId,
    });
    return res.status(httpStatus.OK).json(workflowAndBundle);
  })
);

/**
 * GET /ehr/canvas/patient/:id/metriport-only-bundle
 *
 * Retrieves the latest resource diff workflow and Metriport only bundle if completed
 * @param req.params.id The ID of Canvas Patient.
 * @param req.query.practiceId The ID of Canvas Practice.
 * @returns Resource diff workflow and Metriport only bundle if completed
 */
router.get(
  "/:id/metriport-only-bundle",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const canvasPatientId = getFrom("params").orFail("id", req);
    const canvasPracticeId = getFromQueryOrFail("practiceId", req);
    const workflowAndBundle = await getLatestCanvasResourceDiff({
      cxId,
      canvasPatientId,
      canvasPracticeId,
    });
    return res.status(httpStatus.OK).json(workflowAndBundle);
  })
);

export default router;
