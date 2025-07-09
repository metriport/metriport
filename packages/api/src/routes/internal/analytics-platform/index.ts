import { startCsvToMetricsBatchJob } from "@metriport/core/command/analytics-platform/csv-to-metrics";
import { startFhirToCsvBatchJob } from "@metriport/core/command/analytics-platform/fhir-to-csv";
import { jobRunBodySchema } from "@metriport/shared/domain/job/types";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler } from "../../util";

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
    await startFhirToCsvBatchJob({ cxId, jobId });
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/analytics-platform/csv-to-metrics/run
 *
 * Runs the create resource diff bundles job.
 * @param req.body.cxId - The CX ID.
 * @param req.body.jobId - The job ID.
 * @returns 200 OK
 */
router.post(
  "/csv-to-metrics/run",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { cxId, jobId } = jobRunBodySchema.parse(req.body);
    await startCsvToMetricsBatchJob({ cxId, jobId });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
