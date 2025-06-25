import { jobRunBodySchema } from "@metriport/shared/domain/job/types";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { runDischargeRequeryJob } from "../../../../command/medical/patient/patient-monitoring/discharge-requery/initialize";
import { requestLogger } from "../../../helpers/request-logger";
import { asyncHandler } from "../../../util";

const router = Router();

/**
 * POST /internal/patient/monitoring/job/discharge-requery/run
 *
 * Runs the discharge requery job.
 *
 * @param req.body.cxId - The CX ID.
 * @param req.body.jobId - The job ID.
 * @returns 200 OK
 */
router.post(
  "/discharge-requery/run",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { cxId, jobId } = jobRunBodySchema.parse(req.body);
    await runDischargeRequeryJob({ cxId, jobId });

    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
