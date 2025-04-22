import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { getMetriportOnlyBundleJobPayload } from "../../../external/ehr/canvas/job/metriport-only-bundle/get-job-payload";
import { getLatestMetriportOnlyBundleJobPayload } from "../../../external/ehr/canvas/job/metriport-only-bundle/get-latest-job-payload";
import { startMetriportOnlyBundleJob } from "../../../external/ehr/canvas/job/metriport-only-bundle/start-job";
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
 * The workflow is started asynchronously and jobId is returned.
 * @param req.params.id The ID of Canvas Patient.
 * @param req.query.practiceId The ID of Canvas Practice.
 * @returns the jobId of the workflow
 */
router.post(
  "/:id/metriport-only-bundle",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const canvasPatientId = getFrom("params").orFail("id", req);
    const canvasPracticeId = getFromQueryOrFail("practiceId", req);
    const jobId = await startMetriportOnlyBundleJob({ cxId, canvasPatientId, canvasPracticeId });
    return res.status(httpStatus.OK).json(jobId);
  })
);

/**
 * GET /ehr/canvas/patient/:id/metriport-only-bundle/latest
 *
 * Retrieves the latest resource diff workflow and Metriport only bundle if completed
 * @param req.params.id The ID of Canvas Patient.
 * @param req.query.practiceId The ID of Canvas Practice.
 * @returns Resource diff workflow and Metriport only bundle if completed
 */
router.get(
  "/:id/metriport-only-bundle/latest",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const canvasPatientId = getFrom("params").orFail("id", req);
    const canvasPracticeId = getFromQueryOrFail("practiceId", req);
    const jobPayload = await getLatestMetriportOnlyBundleJobPayload({
      cxId,
      canvasPatientId,
      canvasPracticeId,
    });
    return res.status(httpStatus.OK).json(jobPayload);
  })
);

/**
 * GET /ehr/canvas/patient/:id/metriport-only-bundle/:jobId
 *
 * Retrieves the resource diff workflow and Metriport only bundle if completed
 * @param req.params.id The ID of Canvas Patient.
 * @param req.params.jobId The job ID of the workflow
 * @param req.query.practiceId The ID of Canvas Practice.
 * @returns Resource diff workflow and Metriport only bundle if completed
 */
router.get(
  "/:id/metriport-only-bundle/:jobId",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const canvasPatientId = getFrom("params").orFail("id", req);
    const canvasPracticeId = getFromQueryOrFail("practiceId", req);
    const jobId = getFrom("params").orFail("jobId", req);
    const jobPayload = await getMetriportOnlyBundleJobPayload({
      cxId,
      canvasPatientId,
      canvasPracticeId,
      jobId,
    });
    return res.status(httpStatus.OK).json(jobPayload);
  })
);

export default router;
