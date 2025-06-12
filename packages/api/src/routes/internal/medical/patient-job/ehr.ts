import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { z } from "zod";
import { initializePatientJob } from "../../../../command/job/patient/initialize";
import { runJob } from "../../../../external/ehr/shared/job/bundle/create-resource-diff-bundles/run-job";
import { requestLogger } from "../../../helpers/request-logger";
import { asyncHandler, getFromQueryOrFail } from "../../../util";

const router = Router();

const paramsOpsSchema = z.object({
  practiceId: z.string(),
  ehrPatientId: z.string(),
});

/**
 * POST /internal/medical/patient-job/ehr/athenahealth-create-resource-diff-bundles/run
 *
 * Starts the athenahealth create resource diff bundles job.
 * @param req.query.cxId - The CX ID.
 * @param req.query.jobId - The job ID.
 * @returns 200 OK
 */
router.post(
  "/athenahealth-create-resource-diff-bundles/run",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const ehr = EhrSources.athena;
    const cxId = getFromQueryOrFail("cxId", req);
    const jobId = getFromQueryOrFail("jobId", req);
    const job = await initializePatientJob({ cxId, jobId });
    const paramsOps = paramsOpsSchema.parse(job.paramsOps);
    await runJob({
      jobId,
      ehr,
      cxId,
      practiceId: paramsOps.practiceId,
      metriportPatientId: job.patientId,
      ehrPatientId: paramsOps.ehrPatientId,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/medical/patient-job/ehr/canvas-create-resource-diff-bundles/run
 *
 * Starts the canvas create resource diff bundles job.
 * @param req.query.cxId - The CX ID.
 * @param req.query.jobId - The job ID.
 * @returns 200 OK
 */
router.post(
  "/canvas-create-resource-diff-bundles/run",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const ehr = EhrSources.canvas;
    const cxId = getFromQueryOrFail("cxId", req);
    const jobId = getFromQueryOrFail("jobId", req);
    const job = await initializePatientJob({ cxId, jobId });
    const paramsOps = paramsOpsSchema.parse(job.paramsOps);
    await runJob({
      jobId,
      ehr,
      cxId,
      practiceId: paramsOps.practiceId,
      metriportPatientId: job.patientId,
      ehrPatientId: paramsOps.ehrPatientId,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
