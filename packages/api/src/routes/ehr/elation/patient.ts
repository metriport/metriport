import { BundleType } from "@metriport/core/external/ehr/bundle/bundle-shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { syncElationPatientIntoMetriport } from "../../../external/ehr/elation/command/sync-patient";
import {
  getLatestResourceDiffBundlesJobPayload,
  getResourceDiffBundlesJobPayload,
} from "../../../external/ehr/shared/job/create-resource-diff-bundles/get-job-payload";
import { startCreateResourceDiffBundlesJob } from "../../../external/ehr/shared/job/create-resource-diff-bundles/start-job";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFrom, getFromQueryOrFail } from "../../util";
import { processEhrPatientId } from "../shared";
import { tokenEhrPatientIdQueryParam } from "./auth/middleware";

const router = Router();

/**
 * GET /ehr/elation/patient/:id
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of Elation Patient.
 * @param req.query.practiceId The ID of Elation Practice.
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
 * @param req.query.practiceId The ID of Elation Practice.
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

/**
 * POST /ehr/elation/patient/:id/resource/diff
 *
 * Starts the resource diff job to generate the Metriport only bundle, or Elation only bundle.
 * The job is started asynchronously.
 * @param req.params.id The ID of Elation Patient.
 * @param req.query.practiceId The ID of Elation Practice.
 * @param req.query.direction The direction of the resource diff bundles to create.
 * @returns The job ID of the resource diff job
 */
router.post(
  "/:id/resource/diff",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const elationPatientId = getFrom("params").orFail("id", req);
    const elationPracticeId = getFromQueryOrFail("practiceId", req);
    const jobId = await startCreateResourceDiffBundlesJob({
      ehr: EhrSources.elation,
      cxId,
      practiceId: elationPracticeId,
      patientId: elationPatientId,
    });
    return res.status(httpStatus.OK).json(jobId);
  })
);

/**
 * GET /ehr/elation/patient/:id/resource/diff/latest
 *
 * Retrieves the latest resource diff job and pre-signed URLs for the bundles if completed
 * @param req.params.id The ID of Elation Patient.
 * @param req.query.practiceId The ID of Elation Practice.
 * @param req.query.direction The direction of the resource diff bundles to fetch.
 * @returns Resource diff job and pre-signed URLs for the bundles if completed
 */
router.get(
  "/:id/resource/diff/latest",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const elationPatientId = getFrom("params").orFail("id", req);
    const elationPracticeId = getFromQueryOrFail("practiceId", req);
    const bundle = await getLatestResourceDiffBundlesJobPayload({
      ehr: EhrSources.elation,
      cxId,
      patientId: elationPatientId,
      practiceId: elationPracticeId,
      bundleType: BundleType.RESOURCE_DIFF_METRIPORT_ONLY,
    });
    return res.status(httpStatus.OK).json(bundle);
  })
);

/**
 * GET /ehr/elation/patient/:id/resource/diff/:jobId
 *
 * Retrieves the resource diff job and pre-signed URLs for the bundles if completed
 * @param req.params.id The ID of Elation Patient.
 * @param req.params.jobId The job ID of the job
 * @param req.query.practiceId The ID of Elation Practice.
 * @param req.query.direction The direction of the resource diff bundles to fetch.
 * @returns Resource diff job and pre-signed URLs for the bundles if completed
 */
router.get(
  "/:id/resource/diff/:jobId",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const elationPatientId = getFrom("params").orFail("id", req);
    const elationPracticeId = getFromQueryOrFail("practiceId", req);
    const jobId = getFrom("params").orFail("jobId", req);
    const bundle = await getResourceDiffBundlesJobPayload({
      ehr: EhrSources.elation,
      cxId,
      patientId: elationPatientId,
      practiceId: elationPracticeId,
      jobId,
      bundleType: BundleType.RESOURCE_DIFF_METRIPORT_ONLY,
    });
    return res.status(httpStatus.OK).json(bundle);
  })
);

export default router;
