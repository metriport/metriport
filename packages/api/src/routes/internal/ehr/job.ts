import { isEhrSourceWithCreateResourceDiffBundles } from "@metriport/core/external/ehr/job/create-resource-diff-bundles/shared";
import { BadRequestError } from "@metriport/shared";
import { jobRunBodySchema } from "@metriport/shared/domain/job/types";
import { isEhrSource } from "@metriport/shared/interface/external/ehr/source";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { z } from "zod";
import { initializePatientJob } from "../../../command/job/patient/status/initialize";
import { runJob } from "../../../external/ehr/shared/job/bundle/create-resource-diff-bundles/run-job";
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
    if (!isEhrSourceWithCreateResourceDiffBundles(ehr)) {
      throw new BadRequestError("EHR does not support create resource diff bundles", undefined, {
        ehr,
      });
    }
    const { cxId, jobId } = jobRunBodySchema.parse(req.body);
    const job = await initializePatientJob({ cxId, jobId });
    const { practiceId, ehrPatientId } = paramsOpsSchemaCreateResourceDiffBundles.parse(
      job.paramsOps
    );
    await runJob({
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

export default router;
