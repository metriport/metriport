import { startFhirToCsvBatchJob } from "@metriport/core/command/analytics-platform/fhir-to-csv/batch/fhir-to-csv";
import { buildFhirToCsvHandler } from "@metriport/core/command/analytics-platform/fhir-to-csv/command/fhir-to-csv/fhir-to-csv-factory";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getFromQuery, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * POST /internal/analytics-platform/fhir-to-csv
 *
 * Runs the fhir to csv job.
 * @param req.query.cxId - The CX ID.
 * @param req.query.jobId - The job ID.
 * @param req.query.patientId - The patient ID.
 * @param req.query.inputBundle - The input bundle.
 * @returns 200 OK
 */
router.post(
  "/fhir-to-csv",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getFromQueryOrFail("cxId", req);
    const jobId = getFromQueryOrFail("jobId", req);
    const patientId = getFromQueryOrFail("patientId", req);
    const inputBundle = getFromQuery("inputBundle", req);
    const handler = buildFhirToCsvHandler();
    await handler.processFhirToCsv({ cxId, jobId, patientId, inputBundle });
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/analytics-platform/fhir-to-csv/batch
 *
 * Runs the fhir to csv job.
 * @param req.query.cxId - The CX ID.
 * @param req.query.jobId - The job ID.
 * @param req.query.patientId - The patient ID.
 * @param req.query.inputBundle - The input bundle.
 * @returns 200 OK
 */
router.post(
  "/fhir-to-csv/batch",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getFromQueryOrFail("cxId", req);
    const jobId = getFromQueryOrFail("jobId", req);
    const patientId = getFromQuery("patientId", req);
    const inputBundle = getFromQuery("inputBundle", req);
    await startFhirToCsvBatchJob({ cxId, jobId, patientId, inputBundle });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
