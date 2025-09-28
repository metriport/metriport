import { startCoreTransform } from "@metriport/core/command/analytics-platform/core-transfom/command/core-transform";
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

/**
 * POST /internal/analytics-platform/core-transform
 *
 * Runs the core transform into the analytics platform, for a single patient.
 *
 * @param req.query.cxId - The CX ID.
 * @param req.query.jobId - The job ID.
 * @param req.query.host - The host.
 * @param req.query.user - The user.
 * @param req.query.password - The password.
 * @param req.query.database - The database.
 * @param req.query.schema - The schema.
 */
router.post(
  "/core-transform",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getFromQueryOrFail("cxId", req);
    const database = getFromQueryOrFail("database", req);
    const schema = getFromQueryOrFail("schema", req);

    await startCoreTransform({ cxId, database, schema });

    return res.status(httpStatus.OK).json({ message: "Core transform initiated" });
  })
);

export default router;
