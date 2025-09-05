import { buildFhirToCsvIncrementalHandler } from "@metriport/core/command/analytics-platform/fhir-to-csv/command/fhir-to-csv-incremantal/fhir-to-csv-incremental-factory";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * POST /internal/analytics-platform/fhir-to-csv
 *
 * Runs the incremental fhir to csv job, for a single patient.
 *
 * @param req.query.cxId - The CX ID.
 * @param req.query.jobId - The job ID.
 * @param req.query.patientId - The patient ID.
 * @returns 200 OK
 */
router.post(
  "/fhir-to-csv",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getFromQueryOrFail("cxId", req);
    const jobId = getFromQueryOrFail("jobId", req);
    const patientId = getFromQueryOrFail("patientId", req);

    const handler = buildFhirToCsvIncrementalHandler();
    await handler.processFhirToCsvIncremental({ cxId, jobId, patientId });

    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
