import { startFhirToCsvBatchJob } from "@metriport/core/command/analytics-platform/fhir-to-csv";
import { jobRunBodySchema } from "@metriport/shared/domain/job/types";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getFromQuery } from "../../util";

const router = Router();

/**
 * POST /internal/analytics-platform/fhir-to-csv/run
 *
 * Runs the fhir to csv job.
 * @param req.body.cxId - The CX ID.
 * @param req.body.jobId - The job ID.
 * @returns 200 OK
 */
router.post(
  "/fhir-to-csv/run",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { cxId, jobId } = jobRunBodySchema.parse(req.body);
    const patientId = getFromQuery("patientId", req);
    const bundlesToAppend = getFromQuery("bundlesToAppend", req);
    await startFhirToCsvBatchJob({ cxId, jobId, patientId, bundlesToAppend });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
