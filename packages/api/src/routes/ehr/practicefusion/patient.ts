import { BundleType } from "@metriport/core/external/ehr/bundle/bundle-shared";
import { EhrSources } from "@metriport/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { syncPracticeFusionPatientIntoMetriport } from "../../../external/ehr/practicefusion/command/sync-patient";
import {
  getLatestResourceDiffBundlesJobPayload,
  getResourceDiffBundlesJobPayload,
} from "../../../external/ehr/shared/job/bundle/create-resource-diff-bundles/get-job-payload";
import { startCreateResourceDiffBundlesJob } from "../../../external/ehr/shared/job/bundle/create-resource-diff-bundles/start-job";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFrom, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * GET /ehr/practicefusion/patient/:id
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of PracticeFusion Patient.
 * @param req.query.practiceId The ID of PracticeFusion Practice.
 * @returns Metriport Patient ID if found.
 */
router.get(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const practicefusionPatientId = getFrom("params").orFail("id", req);
    const practicefusionPracticeId = getFromQueryOrFail("practiceId", req);
    const patientId = await syncPracticeFusionPatientIntoMetriport({
      cxId,
      practicefusionPracticeId,
      practicefusionPatientId,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

/**
 * POST /ehr/practicefusion/patient/:id
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of PracticeFusion Patient.
 * @param req.query.practiceId The ID of PracticeFusion Practice.
 * @returns Metriport Patient ID if found.
 */
router.post(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const practicefusionPatientId = getFrom("params").orFail("id", req);
    const practicefusionPracticeId = getFromQueryOrFail("practiceId", req);
    const patientId = await syncPracticeFusionPatientIntoMetriport({
      cxId,
      practicefusionPracticeId,
      practicefusionPatientId,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

/**
 * POST /ehr/practicefusion/patient/:id/resource/diff
 *
 * Starts the resource diff job to generate the Metriport only bundle, or PracticeFusion only bundle.
 * The job is started asynchronously.
 * @param req.params.id The ID of PracticeFusion Patient.
 * @param req.query.practiceId The ID of PracticeFusion Practice.
 * @returns The job ID of the resource diff job
 */
router.post(
  "/:id/resource/diff",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const practicefusionPatientId = getFrom("params").orFail("id", req);
    const practicefusionPracticeId = getFromQueryOrFail("practiceId", req);
    const jobId = await startCreateResourceDiffBundlesJob({
      ehr: EhrSources.practicefusion,
      cxId,
      practiceId: practicefusionPracticeId,
      ehrPatientId: practicefusionPatientId,
    });
    return res.status(httpStatus.OK).json(jobId);
  })
);

/**
 * GET /ehr/practicefusion/patient/:id/resource/diff/latest
 *
 * Retrieves the latest resource diff job and pre-signed URLs for the bundles if completed
 * @param req.params.id The ID of PracticeFusion Patient.
 * @returns Resource diff job and pre-signed URLs for the bundles if completed
 */
router.get(
  "/:id/resource/diff/latest",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const practicefusionPatientId = getFrom("params").orFail("id", req);
    const bundle = await getLatestResourceDiffBundlesJobPayload({
      ehr: EhrSources.practicefusion,
      cxId,
      ehrPatientId: practicefusionPatientId,
      bundleType: BundleType.RESOURCE_DIFF_METRIPORT_ONLY,
    });
    return res.status(httpStatus.OK).json(bundle);
  })
);

/**
 * GET /ehr/practicefusion/patient/:id/resource/diff/:jobId
 *
 * Retrieves the resource diff job and pre-signed URLs for the bundles if completed
 * @param req.params.id The ID of PracticeFusion Patient.
 * @param req.params.jobId The job ID of the job
 * @returns Resource diff job and pre-signed URLs for the bundles if completed
 */
router.get(
  "/:id/resource/diff/:jobId",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const practicefusionPatientId = getFrom("params").orFail("id", req);
    const jobId = getFrom("params").orFail("jobId", req);
    const bundle = await getResourceDiffBundlesJobPayload({
      ehr: EhrSources.practicefusion,
      cxId,
      ehrPatientId: practicefusionPatientId,
      jobId,
      bundleType: BundleType.RESOURCE_DIFF_METRIPORT_ONLY,
    });
    return res.status(httpStatus.OK).json(bundle);
  })
);

export default router;
