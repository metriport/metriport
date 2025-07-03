import { isEhrSourceWithResourceDiffBundles } from "@metriport/core/external/ehr/job/bundle/shared";
import { BadRequestError } from "@metriport/shared";
import { jobRunBodySchema } from "@metriport/shared/domain/job/types";
import { isEhrSource } from "@metriport/shared/interface/external/ehr/source";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { z } from "zod";
import { initializePatientJob } from "../../../command/job/patient/status/initialize";
import { runJob as runCreateResourceDiffBundlesJob } from "../../../external/ehr/shared/job/bundle/create-resource-diff-bundles/run-job";
import { runJob as runContributeBundlesJob } from "../../../external/ehr/shared/job/bundle/contribute-bundles/run-job";
import { runJob as runWriteBackBundlesJob } from "../../../external/ehr/shared/job/bundle/write-back-bundles/run-job";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getFromQueryOrFail } from "../../util";

const router = Router();

const paramsOpsSchemaCreateResourceDiffBundles = z.object({
  practiceId: z.string(),
  ehrPatientId: z.string(),
});

/**
 * POST /internal/ehr/:ehrId/job/create-resource-diff-bundles/run
 *
 * Runs the create resource diff bundles job.
 * @param req.body.cxId - The CX ID.
 * @param req.body.jobId - The job ID.
 * @returns 200 OK
 */
router.post(
  "/create-resource-diff-bundles/run",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const ehr = getFromQueryOrFail("ehrId", req);
    if (!isEhrSource(ehr)) throw new BadRequestError("Invalid EHR", undefined, { ehr });
    if (!isEhrSourceWithResourceDiffBundles(ehr)) {
      throw new BadRequestError("EHR does not support create resource diff bundles", undefined, {
        ehr,
      });
    }
    const { cxId, jobId } = jobRunBodySchema.parse(req.body);
    const job = await initializePatientJob({ cxId, jobId });
    const { practiceId, ehrPatientId } = paramsOpsSchemaCreateResourceDiffBundles.parse(
      job.paramsOps
    );
    await runCreateResourceDiffBundlesJob({
      jobId,
      ehr,
      cxId,
      practiceId,
      metriportPatientId: job.patientId,
      ehrPatientId,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

const paramsOpsSchemaContributeOrWriteBackBundles = z.object({
  practiceId: z.string(),
  ehrPatientId: z.string(),
  createResourceDiffBundlesJobId: z.string(),
});

/**
 * POST /internal/ehr/:ehrId/job/contribute-bundles/run
 *
 * Runs the contribute bundles job.
 * @param req.body.cxId - The CX ID.
 * @param req.body.jobId - The job ID.
 * @returns 200 OK
 */
router.post(
  "/contribute-bundles/run",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const ehr = getFromQueryOrFail("ehrId", req);
    if (!isEhrSource(ehr)) throw new BadRequestError("Invalid EHR", undefined, { ehr });
    if (!isEhrSourceWithResourceDiffBundles(ehr)) {
      throw new BadRequestError("EHR does not support create resource diff bundles", undefined, {
        ehr,
      });
    }
    const { cxId, jobId } = jobRunBodySchema.parse(req.body);
    const job = await initializePatientJob({ cxId, jobId });
    const { practiceId, ehrPatientId, createResourceDiffBundlesJobId } =
      paramsOpsSchemaContributeOrWriteBackBundles.parse(job.paramsOps);
    await runContributeBundlesJob({
      jobId,
      ehr,
      cxId,
      practiceId,
      metriportPatientId: job.patientId,
      ehrPatientId,
      createResourceDiffBundlesJobId,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/ehr/:ehrId/job/write-back-bundles/run
 *
 * Runs the write back bundles job.
 * @param req.body.cxId - The CX ID.
 * @param req.body.jobId - The job ID.
 * @returns 200 OK
 */
router.post(
  "/write-back-bundles/run",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const ehr = getFromQueryOrFail("ehrId", req);
    if (!isEhrSource(ehr)) throw new BadRequestError("Invalid EHR", undefined, { ehr });
    if (!isEhrSourceWithResourceDiffBundles(ehr)) {
      throw new BadRequestError("EHR does not support create resource diff bundles", undefined, {
        ehr,
      });
    }
    const { cxId, jobId } = jobRunBodySchema.parse(req.body);
    const job = await initializePatientJob({ cxId, jobId });
    const { practiceId, ehrPatientId, createResourceDiffBundlesJobId } =
      paramsOpsSchemaContributeOrWriteBackBundles.parse(job.paramsOps);
    await runWriteBackBundlesJob({
      jobId,
      ehr,
      cxId,
      practiceId,
      metriportPatientId: job.patientId,
      ehrPatientId,
      createResourceDiffBundlesJobId,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
