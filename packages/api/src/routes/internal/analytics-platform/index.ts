import { ingestPatientIntoAnalyticsPlatform } from "@metriport/core/command/analytics-platform/incremental-ingestion";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * POST /internal/analytics-platform/ingestion/incremental
 *
 * Runs the incremental ingestion into the analytics platform, for a single patient.
 *
 * @param req.query.cxId - The CX ID.
 * @param req.query.patientId - The patient ID.
 * @returns 200 OK
 */
router.post(
  "/ingestion/incremental",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getFromQueryOrFail("cxId", req);
    const patientId = getFromQueryOrFail("patientId", req);

    // validate cx<>patient
    await getPatientOrFail({ id: patientId, cxId });

    const jobId = await ingestPatientIntoAnalyticsPlatform({ cxId, patientId });

    const message = jobId ? "Ingestion initiated" : "Ingestion not initiated";
    return res.status(httpStatus.OK).json({ message, jobId });
  })
);

export default router;
