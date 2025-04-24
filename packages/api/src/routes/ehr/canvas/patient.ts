import { BadRequestError } from "@metriport/shared";
import { isResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { syncCanvasPatientIntoMetriport } from "../../../external/ehr/canvas/command/sync-patient";
import {
  getLatestResourceDiffBundlesJobPayload,
  getResourceDiffBundlesJobPayload,
} from "../../../external/ehr/canvas/job/create-resource-diff-bundles/get-job-payload";
import { createResourceDiffBundlesJob } from "../../../external/ehr/canvas/job/create-resource-diff-bundles/start-job";
import { createCondition } from "../../../external/ehr/canvas/command/create-condition";
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
 * POST /ehr/canvas/patient/:id/resource/diff
 *
 * Starts the resource diff job to generate the Metriport only bundle, or Canvas only bundle.
 * The job is started asynchronously.
 * @param req.params.id The ID of Canvas Patient.
 * @param req.query.practiceId The ID of Canvas Practice.
 * @param req.query.direction The direction of the resource diff bundles to create.
 * @returns The job ID of the resource diff job
 */
router.post(
  "/:id/resource/diff",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const canvasPatientId = getFrom("params").orFail("id", req);
    const canvasPracticeId = getFromQueryOrFail("practiceId", req);
    const direction = getFromQueryOrFail("direction", req);
    if (!isResourceDiffDirection(direction)) {
      throw new BadRequestError("Invalid direction", undefined, {
        direction,
      });
    }
    const jobId = await createResourceDiffBundlesJob({
      cxId,
      canvasPatientId,
      canvasPracticeId,
      direction,
    });
    return res.status(httpStatus.OK).json(jobId);
  })
);

/**
 * POST /ehr/canvas/patient/:id/condition
 *
 * Creates a condition
 * @param req.params.id The ID of Canvas Patient.
 * @param req.query.practiceId The ID of Canvas Practice.
 * @param req.body The FHIR Resource payload
 * @returns Canvas API response
 */
router.post(
  "/:id/condition",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const canvasPatientId = getFrom("params").orFail("id", req);
    const canvasPracticeId = getFromQueryOrFail("practiceId", req);
    const canvasPractitionerId = getFromQueryOrFail("practitionerId", req);
    const payload = req.body; // TODO Parse body https://github.com/metriport/metriport-internal/issues/2170
    const conditionDetails = await createCondition({
      cxId,
      canvasPatientId,
      canvasPracticeId,
      canvasPractitionerId,
      condition: payload,
    });
    return res.status(httpStatus.OK).json(conditionDetails);
  })
);

/**
 * GET /ehr/canvas/patient/:id/resource/diff/latest
 *
 * Retrieves the latest resource diff job and pre-signed URLs for the bundles if completed
 * @param req.params.id The ID of Canvas Patient.
 * @param req.query.practiceId The ID of Canvas Practice.
 * @param req.query.direction The direction of the resource diff bundles to fetch.
 * @returns Resource diff job and pre-signed URLs for the bundles if completed
 */
router.get(
  "/:id/resource/diff/latest",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const canvasPatientId = getFrom("params").orFail("id", req);
    const canvasPracticeId = getFromQueryOrFail("practiceId", req);
    const direction = getFromQueryOrFail("direction", req);
    if (!isResourceDiffDirection(direction)) {
      throw new BadRequestError("Invalid direction", undefined, {
        direction,
      });
    }
    const bundle = await getLatestResourceDiffBundlesJobPayload({
      cxId,
      canvasPatientId,
      canvasPracticeId,
      direction,
    });
    return res.status(httpStatus.OK).json(bundle);
  })
);

/**
 * GET /ehr/canvas/patient/:id/resource/diff/:jobId
 *
 * Retrieves the resource diff job and pre-signed URLs for the bundles if completed
 * @param req.params.id The ID of Canvas Patient.
 * @param req.params.jobId The job ID of the job
 * @param req.query.practiceId The ID of Canvas Practice.
 * @param req.query.direction The direction of the resource diff bundles to fetch.
 * @returns Resource diff job and pre-signed URLs for the bundles if completed
 */
router.get(
  "/:id/resource/diff/:jobId",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const canvasPatientId = getFrom("params").orFail("id", req);
    const canvasPracticeId = getFromQueryOrFail("practiceId", req);
    const jobId = getFrom("params").orFail("jobId", req);
    const direction = getFromQueryOrFail("direction", req);
    if (!isResourceDiffDirection(direction)) {
      throw new BadRequestError("Invalid direction", undefined, {
        direction,
      });
    }
    const bundle = await getResourceDiffBundlesJobPayload({
      cxId,
      canvasPatientId,
      canvasPracticeId,
      jobId,
      direction,
    });
    return res.status(httpStatus.OK).json(bundle);
  })
);

export default router;
