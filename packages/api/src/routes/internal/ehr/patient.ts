import { isResourceDiffBundleType } from "@metriport/core/external/ehr/bundle/bundle-shared";
import { BadRequestError } from "@metriport/shared";
import { isEhrSource } from "@metriport/shared/interface/external/ehr/source";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { contributeResourceDiffBundle } from "../../../external/ehr/shared/command/bundle/contribute-resource-diff-bundle";
import { startContributeBundlesJob } from "../../../external/ehr/shared/job/bundle/contribute-bundles/start-job";
import {
  getLatestResourceDiffBundlesJobPayload,
  getResourceDiffBundlesJobPayload,
} from "../../../external/ehr/shared/job/bundle/create-resource-diff-bundles/get-job-payload";
import { startCreateResourceDiffBundlesJob } from "../../../external/ehr/shared/job/bundle/create-resource-diff-bundles/start-job";
import { startWriteBackBundlesJob } from "../../../external/ehr/shared/job/bundle/write-back-bundles/start-job";
import { requestLogger } from "../../helpers/request-logger";
import { getUUIDFrom } from "../../schemas/uuid";
import { asyncHandler, getFrom, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * POST /internal/ehr/:ehrId/patient/:id/resource/diff
 *
 * Starts the resource diff job to generate the resource diff bundles.
 *
 * @param req.query.ehrId - The EHR source.
 * @param req.query.cxId - The CX ID of the patient.
 * @param req.params.id - The patient id of the EHR patient.
 * @param req.query.practiceId - The practice id of the EHR patient.
 * @returns The job ID of the resource diff job
 */
router.post(
  "/:id/resource/diff",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const ehr = getFromQueryOrFail("ehrId", req);
    if (!isEhrSource(ehr)) throw new BadRequestError("Invalid EHR", undefined, { ehr });
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFrom("params").orFail("id", req);
    const practiceId = getFromQueryOrFail("practiceId", req);
    const jobId = await startCreateResourceDiffBundlesJob({
      ehr,
      cxId,
      ehrPatientId: patientId,
      practiceId,
    });
    return res.status(httpStatus.OK).json(jobId);
  })
);

/**
 * GET /internal/ehr/:ehrId/patient/:id/resource/diff/latest
 *
 * Retrieves the latest resource diff job and pre-signed URLs for the resource diff bundles if completed
 *
 * @param req.query.ehrId - The EHR source.
 * @param req.query.cxId - The CX ID of the patient.
 * @param req.params.id - The patient id of the EHR patient.
 * @param req.query.bundleType - The type of bundle to fetch.
 * @returns Resource diff job and pre-signed URLs for the bundles if completed
 */
router.get(
  "/:id/resource/diff/latest",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const ehr = getFromQueryOrFail("ehrId", req);
    if (!isEhrSource(ehr)) throw new BadRequestError("Invalid EHR", undefined, { ehr });
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFrom("params").orFail("id", req);
    const bundleType = getFromQueryOrFail("bundleType", req);
    if (!isResourceDiffBundleType(bundleType)) {
      throw new BadRequestError("Invalid bundle type", undefined, {
        bundleType,
      });
    }
    const bundle = await getLatestResourceDiffBundlesJobPayload({
      ehr,
      cxId,
      ehrPatientId: patientId,
      bundleType,
    });
    return res.status(httpStatus.OK).json(bundle);
  })
);

/**
 * GET /internal/ehr/:ehrId/patient/:id/resource/diff/:jobId
 *
 * Retrieves the resource diff job by job id and pre-signed URLs for the resource diff bundles if completed
 *
 * @param req.query.ehrId - The EHR source.
 * @param req.query.cxId - The CX ID of the patient.
 * @param req.params.id - The patient id of the EHR patient.
 * @param req.query.bundleType - The type of bundle to fetch.
 * @param req.params.jobId - The job ID of the resource diff job.
 * @returns Resource diff job and pre-signed URLs for the bundles if completed
 */
router.get(
  "/:id/resource/diff/:jobId",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const ehr = getFromQueryOrFail("ehrId", req);
    if (!isEhrSource(ehr)) throw new BadRequestError("Invalid EHR", undefined, { ehr });
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFrom("params").orFail("id", req);
    const bundleType = getFromQueryOrFail("bundleType", req);
    if (!isResourceDiffBundleType(bundleType)) {
      throw new BadRequestError("Invalid bundle type", undefined, {
        bundleType,
      });
    }
    const jobId = getFrom("params").orFail("jobId", req);
    const bundle = await getResourceDiffBundlesJobPayload({
      ehr,
      cxId,
      ehrPatientId: patientId,
      bundleType,
      jobId,
    });
    return res.status(httpStatus.OK).json(bundle);
  })
);

/**
 * POST /internal/ehr/:ehrId/patient/:id/resource/contribute
 *
 * Starts the contribute bundles job to contribute the resource diff bundles to the EHR.
 *
 * @param req.query.ehrId - The EHR source.
 * @param req.query.cxId - The CX ID of the patient.
 * @param req.params.id - The patient id of the EHR patient.
 * @param req.query.practiceId - The practice id of the EHR patient.
 * @param req.query.createResourceDiffBundlesJobId - The job id of the create resource diff bundles job from which the bundles were created.
 * @returns The job ID of the contribute bundles job
 */
router.post(
  "/:id/resource/contribute",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const ehr = getFromQueryOrFail("ehrId", req);
    if (!isEhrSource(ehr)) throw new BadRequestError("Invalid EHR", undefined, { ehr });
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFrom("params").orFail("id", req);
    const practiceId = getFromQueryOrFail("practiceId", req);
    const resourceType = getFromQueryOrFail("resourceType", req);
    const createResourceDiffBundlesJobId = getFromQueryOrFail(
      "createResourceDiffBundlesJobId",
      req
    );
    const jobId = await startContributeBundlesJob({
      ehr,
      cxId,
      ehrPatientId: patientId,
      practiceId,
      resourceType,
      createResourceDiffBundlesJobId,
    });
    return res.status(httpStatus.OK).json(jobId);
  })
);

// TODO: Remove this route after the write back bundles job is implemented
/**
 * POST /internal/ehr/:ehrId/patient/:id/resource/diff/:jobId/contribute
 *
 * Contributes the resource diff bundle.
 *
 * @param req.query.ehrId - The EHR source.
 * @param req.query.cxId - The CX ID of the patient.
 * @param req.params.id - The patient id of the EHR patient.
 * @param req.query.resourceType - The resource type to refresh.
 * @param req.params.jobId - The job ID of the resource diff job.
 * @returns 200 OK
 */
router.post(
  "/:id/resource/diff/:jobId/contribute",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const ehr = getFromQueryOrFail("ehrId", req);
    if (!isEhrSource(ehr)) throw new BadRequestError("Invalid EHR", undefined, { ehr });
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFrom("params").orFail("id", req);
    const resourceType = getFromQueryOrFail("resourceType", req);
    const jobId = getFrom("params").orFail("jobId", req);
    await contributeResourceDiffBundle({
      ehr,
      cxId,
      ehrPatientId: patientId,
      resourceType,
      jobId,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/ehr/:ehrId/patient/:id/resource/contribute/:jobId/contribute
 *
 * Contributes the resource diff bundle.
 *
 * @param req.query.ehrId - The EHR source.
 * @param req.query.cxId - The CX ID of the patient.
 * @param req.params.id - The patient id of the EHR patient.
 * @param req.query.resourceType - The resource type to refresh.
 * @param req.params.jobId - The job ID of the contribute bundles job.
 * @returns 200 OK
 */
router.post(
  "/:id/resource/contribute/:jobId/contribute",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const ehr = getFromQueryOrFail("ehrId", req);
    if (!isEhrSource(ehr)) throw new BadRequestError("Invalid EHR", undefined, { ehr });
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFrom("params").orFail("id", req);
    const resourceType = getFromQueryOrFail("resourceType", req);
    const jobId = getFrom("params").orFail("jobId", req);
    await contributeResourceDiffBundle({
      ehr,
      cxId,
      ehrPatientId: patientId,
      resourceType,
      jobId,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/ehr/:ehrId/patient/:id/resource/write-back
 *
 * Starts the write back bundles job to write the resource diff bundles to the EHR.
 *
 * @param req.query.ehrId - The EHR source.
 * @param req.query.cxId - The CX ID of the patient.
 * @param req.params.id - The patient id of the EHR patient.
 * @param req.query.practiceId - The practice id of the EHR patient.
 * @param req.query.createResourceDiffBundlesJobId - The job id of the create resource diff bundles job from which the bundles were created.
 * @returns The job ID of the write back bundles job
 */
router.post(
  "/:id/resource/write-back",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const ehr = getFromQueryOrFail("ehrId", req);
    if (!isEhrSource(ehr)) throw new BadRequestError("Invalid EHR", undefined, { ehr });
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFrom("params").orFail("id", req);
    const practiceId = getFromQueryOrFail("practiceId", req);
    const resourceType = getFromQueryOrFail("resourceType", req);
    const createResourceDiffBundlesJobId = getFromQueryOrFail(
      "createResourceDiffBundlesJobId",
      req
    );
    const jobId = await startWriteBackBundlesJob({
      ehr,
      cxId,
      ehrPatientId: patientId,
      practiceId,
      resourceType,
      createResourceDiffBundlesJobId,
    });
    return res.status(httpStatus.OK).json(jobId);
  })
);

export default router;
