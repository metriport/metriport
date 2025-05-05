import { isSupportedCanvasResource } from "@metriport/core/external/ehr/canvas/index";
import { BadRequestError, isValidJobEntryStatus } from "@metriport/shared";
import { isResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import { isEhrSource } from "@metriport/shared/interface/external/ehr/source";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { setPatientJobEntryStatus } from "../../../command/job/patient/set-entry-status";
import { contributeEhrOnlyBundle } from "../../../external/ehr/shared/command/contribute-ehr-only-bundle";
import { fetchBundlePreSignedUrls } from "../../../external/ehr/shared/command/fetch-bundle-presignd-urls";
import {
  getLatestResourceDiffBundlesJobPayload,
  getResourceDiffBundlesJobPayload,
} from "../../../external/ehr/shared/job/create-resource-diff-bundles/get-job-payload";
import { createResourceDiffBundlesJob } from "../../../external/ehr/shared/job/create-resource-diff-bundles/start-job";
import { requestLogger } from "../../helpers/request-logger";
import { getUUIDFrom } from "../../schemas/uuid";
import { asyncHandler, getFrom, getFromQueryAsBoolean, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * POST /internal/ehr/:ehrId/patient/:id/resource/refresh
 *
 * Refreshes the cached bundles of resources in Canvas across all supported resource types.
 * @param req.params.ehrId The EHR to refresh the bundles for.
 * @param req.query.cxId The cxId of the patient.
 * @param req.params.id The ID of Canvas Patient.
 * @param req.query.practiceId The ID of Canvas Practice.
 * @returns 200 OK
 */
router.post(
  "/:id/resource/refresh",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const ehr = getFrom("params").orFail("ehrId", req);
    if (!isEhrSource(ehr)) throw new BadRequestError("Invalid EHR", undefined, { ehr });
    /* TODO: Implement refreshCanvasBundles
    refreshCanvasBundles({
      cxId,
      canvasPracticeId,
      canvasPatientId,
    }).catch(processAsyncError("Canvas refreshCanvasBundles"));
    */
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/ehr/:ehrId/patient/:id/resource/diff
 *
 * Starts the resource diff job to generate the Metriport only bundle, or Canvas only bundle.
 * The job is started asynchronously.
 * @param req.query.cxId The cxId of the patient.
 * @param req.params.ehrId The EHR to fetch the resource diff job for.
 * @param req.params.id The ID of EHR Patient.
 * @param req.query.practiceId The ID of EHR Practice.
 * @param req.query.direction The direction of the resource diff bundles to create.
 * @returns The job ID of the resource diff job
 */
router.post(
  "/:id/resource/diff",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const ehr = getFrom("params").orFail("ehrId", req);
    if (!isEhrSource(ehr)) throw new BadRequestError("Invalid EHR", undefined, { ehr });
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFrom("params").orFail("id", req);
    const practiceId = getFromQueryOrFail("practiceId", req);
    const direction = getFromQueryOrFail("direction", req);
    if (!isResourceDiffDirection(direction)) {
      throw new BadRequestError("Invalid direction", undefined, {
        direction,
      });
    }
    const jobId = await createResourceDiffBundlesJob({
      ehr,
      cxId,
      patientId,
      practiceId,
      direction,
    });
    return res.status(httpStatus.OK).json(jobId);
  })
);

/**
 * GET /internal/ehr/:ehrId/patient/:id/resource/diff/latest
 *
 * Retrieves the latest resource diff job and pre-signed URLs for the resource diff bundles if completed
 * @param req.query.cxId The cxId of the patient.
 * @param req.params.ehrId The EHR to fetch the resource diff job for.
 * @param req.params.id The ID of EHR Patient.
 * @param req.query.practiceId The ID of EHR Practice.
 * @param req.query.direction The direction of the resource diff bundles to create.
 * @returns Resource diff job and pre-signed URLs for the bundles if completed
 */
router.get(
  "/:id/resource/diff/latest",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const ehr = getFrom("params").orFail("ehrId", req);
    if (!isEhrSource(ehr)) throw new BadRequestError("Invalid EHR", undefined, { ehr });
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFrom("params").orFail("id", req);
    const practiceId = getFromQueryOrFail("practiceId", req);
    const direction = getFromQueryOrFail("direction", req);
    if (!isResourceDiffDirection(direction)) {
      throw new BadRequestError("Invalid direction", undefined, {
        direction,
      });
    }
    const bundle = await getLatestResourceDiffBundlesJobPayload({
      ehr,
      cxId,
      patientId,
      practiceId,
      direction,
    });
    return res.status(httpStatus.OK).json(bundle);
  })
);

/**
 * GET /internal/ehr/:ehrId/patient/:id/resource/diff/:jobId
 *
 * Retrieves the resource diff job by jobId and pre-signed URLs for the resource diff bundles if completed
 * @param req.query.cxId The cxId of the patient.
 * @param req.params.ehrId The EHR to fetch the resource diff job for.
 * @param req.params.id The ID of EHR Patient.
 * @param req.query.practiceId The ID of EHR Practice.
 * @param req.query.direction The direction of the resource diff bundles to create.
 * @param req.params.jobId The job ID of the resource diff job.
 * @returns Resource diff job and pre-signed URLs for the bundles if completed
 */
router.get(
  "/:id/resource/diff/:jobId",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const ehr = getFrom("params").orFail("ehrId", req);
    if (!isEhrSource(ehr)) throw new BadRequestError("Invalid EHR", undefined, { ehr });
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFrom("params").orFail("id", req);
    const practiceId = getFromQueryOrFail("practiceId", req);
    const direction = getFromQueryOrFail("direction", req);
    if (!isResourceDiffDirection(direction)) {
      throw new BadRequestError("Invalid direction", undefined, {
        direction,
      });
    }
    const jobId = getFrom("params").orFail("jobId", req);
    const bundle = await getResourceDiffBundlesJobPayload({
      ehr,
      cxId,
      patientId,
      practiceId,
      direction,
      jobId,
    });
    return res.status(httpStatus.OK).json(bundle);
  })
);

/**
 * POST /internal/ehr/:ehrId/patient/:id/resource/diff/ehr-only/set-entry-status
 *
 * Sets the status of a patient job entry.
 * @param req.query.cxId The cxId of the patient.
 * @param req.params.ehrId The EHR to fetch the resource diff job for.
 * @param req.params.id The ID of EHR Patient.
 * @param req.query.practiceId The ID of EHR Practice.
 * @param req.query.jobId The job ID.
 * @param req.query.entryStatus The status of the entry.
 * @returns 200 OK
 */
router.post(
  "/:id/resource/diff/ehr-only/set-entry-status",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const ehr = getFrom("params").orFail("ehrId", req);
    if (!isEhrSource(ehr)) throw new BadRequestError("Invalid EHR", undefined, { ehr });
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFrom("params").orFail("id", req);
    const practiceId = getFromQueryOrFail("practiceId", req);
    const jobId = getFromQueryOrFail("jobId", req);
    const entryStatus = getFromQueryOrFail("entryStatus", req);
    if (!isValidJobEntryStatus(entryStatus)) {
      throw new BadRequestError("Status must a valid job entry status");
    }
    await setPatientJobEntryStatus({
      jobId,
      cxId,
      entryStatus,
      onCompleted: async () => {
        await contributeEhrOnlyBundle({
          ehr,
          cxId,
          practiceId,
          patientId,
          jobId,
        });
      },
    });
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * GET /internal/ehr/:ehrId/patient/:id/resource/bundle/pre-signed-urls
 *
 * Fetches the pre-signed URLs for the EHR bundles for the EHR patient by resource type
 * @param req.query.cxId The cxId of the patient.
 * @param req.params.ehrId The EHR to fetch the resource diff job for.
 * @param req.params.id The ID of EHR Patient.
 * @param req.query.practiceId The ID of EHR Practice.
 * @param req.query.resourceType The resource type to fetch
 * @param req.query.refresh Whether to refresh the bundle (optional)
 * @returns EHR bundle
 */
router.get(
  "/:id/resource/bundle/pre-signed-urls",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const ehr = getFrom("params").orFail("ehrId", req);
    if (!isEhrSource(ehr)) throw new BadRequestError("Invalid EHR", undefined, { ehr });
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFrom("params").orFail("id", req);
    const practiceId = getFromQueryOrFail("practiceId", req);
    const resourceType = getFromQueryOrFail("resourceType", req);
    if (!isSupportedCanvasResource(resourceType)) {
      throw new BadRequestError("Resource type is not supported for bundle", undefined, {
        resourceType,
      });
    }
    const refresh = getFromQueryAsBoolean("refresh", req);
    const preSignedUrls = await fetchBundlePreSignedUrls({
      ehr,
      cxId,
      practiceId,
      patientId,
      resourceType,
      refresh,
    });
    return res.status(httpStatus.OK).json(preSignedUrls);
  })
);

export default router;
