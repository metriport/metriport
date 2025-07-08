import { BundleType } from "@metriport/core/external/ehr/bundle/bundle-shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { syncPatient } from "../../../external/ehr/shared/command/sync/sync-patient";
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
 * GET /ehr/athenahealth/patient/:id
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of AthenaHealth Patient.
 * @param req.query.practiceId The ID of AthenaHealth Practice.
 * @param req.query.departmentId The ID of AthenaHealth Department.
 * @returns Metriport Patient if found.
 */
router.get(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const athenaPatientId = getFrom("params").orFail("id", req);
    const athenaPracticeId = getFromQueryOrFail("practiceId", req);
    const athenaDepartmentId = getFromQueryOrFail("departmentId", req);
    const patientId = await syncPatient({
      ehr: EhrSources.athena,
      cxId,
      practiceId: athenaPracticeId,
      ehrPatientId: athenaPatientId,
      departmentId: athenaDepartmentId,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

/**
 * POST /ehr/athenahealth/patient/:id
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of AthenaHealth Patient.
 * @param req.query.practiceId The ID of AthenaHealth Practice.
 * @param req.query.departmentId The ID of AthenaHealth Department.
 * @returns Metriport Patient if found.
 */
router.post(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const athenaPatientId = getFrom("params").orFail("id", req);
    const athenaPracticeId = getFromQueryOrFail("practiceId", req);
    const athenaDepartmentId = getFromQueryOrFail("departmentId", req);
    const patientId = await syncAthenaPatientIntoMetriport({
      cxId,
      practiceId: athenaPracticeId,
      ehrPatientId: athenaPatientId,
      athenaDepartmentId,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

/**
 * POST /ehr/athenahealth/patient/:id/resource/diff
 *
 * Starts the resource diff job to generate the Metriport only bundle, or AthenaHealth only bundle.
 * The job is started asynchronously.
 * @param req.params.id The ID of AthenaHealth Patient.
 * @param req.query.practiceId The ID of AthenaHealth Practice.
 * @returns The job ID of the resource diff job
 */
router.post(
  "/:id/resource/diff",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const athenaPatientId = getFrom("params").orFail("id", req);
    const athenaPracticeId = getFromQueryOrFail("practiceId", req);
    const jobId = await startCreateResourceDiffBundlesJob({
      ehr: EhrSources.athena,
      cxId,
      practiceId: athenaPracticeId,
      ehrPatientId: athenaPatientId,
    });
    return res.status(httpStatus.OK).json(jobId);
  })
);

/**
 * GET /ehr/athenahealth/patient/:id/resource/diff/latest
 *
 * Retrieves the latest resource diff job and pre-signed URLs for the bundles if completed
 * @param req.params.id The ID of AthenaHealth Patient.
 * @returns Resource diff job and pre-signed URLs for the bundles if completed
 */
router.get(
  "/:id/resource/diff/latest",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const athenaPatientId = getFrom("params").orFail("id", req);
    const bundle = await getLatestResourceDiffBundlesJobPayload({
      ehr: EhrSources.athena,
      cxId,
      ehrPatientId: athenaPatientId,
      bundleType: BundleType.RESOURCE_DIFF_METRIPORT_ONLY,
    });
    return res.status(httpStatus.OK).json(bundle);
  })
);

/**
 * GET /ehr/athenahealth/patient/:id/resource/diff/:jobId
 *
 * Retrieves the resource diff job and pre-signed URLs for the bundles if completed
 * @param req.params.id The ID of AthenaHealth Patient.
 * @param req.params.jobId The job ID of the job
 * @returns Resource diff job and pre-signed URLs for the bundles if completed
 */
router.get(
  "/:id/resource/diff/:jobId",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const athenaPatientId = getFrom("params").orFail("id", req);
    const jobId = getFrom("params").orFail("jobId", req);
    const bundle = await getResourceDiffBundlesJobPayload({
      ehr: EhrSources.athena,
      cxId,
      ehrPatientId: athenaPatientId,
      jobId,
      bundleType: BundleType.RESOURCE_DIFF_METRIPORT_ONLY,
    });
    return res.status(httpStatus.OK).json(bundle);
  })
);

export default router;
