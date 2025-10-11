import { startCoreTransform } from "@metriport/core/command/analytics-platform/core-transfom/command/core-transform";
import { rebuildCoreSchemas } from "@metriport/core/command/analytics-platform/core-transform/rebuild-core";
import { ingestPatientIntoAnalyticsPlatform } from "@metriport/core/command/analytics-platform/incremental-ingestion";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getFromQuery, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * POST /internal/analytics-platform/ingestion/manual-incremental
 *
 * Runs the incremental ingestion into the analytics platform, for a single patient.
 *
 * @param req.query.cxId - The CX ID.
 * @param req.query.patientId - The patient ID.
 * @returns 200 OK
 */
router.post(
  "/ingestion/manual-incremental",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getFromQueryOrFail("cxId", req);
    const patientId = getFromQueryOrFail("patientId", req);

    // validate cx<>patient
    await getPatientOrFail({ id: patientId, cxId });

    const jobId = await ingestPatientIntoAnalyticsPlatform({ cxId, patientId });

    const message = jobId ? "Ingestion initiated" : "Ingestion not initiated - not enabled for cx?";
    return res.status(httpStatus.OK).json({ message, jobId });
  })
);

/**
 * @deprecated Remove this once we validate the flow, this should be triggered through POST /internal/analytics-platform/ingestion/core/rebuild
 *
 * POST /internal/analytics-platform/manual-core-transform
 *
 * Runs the core transform into the analytics platform, for a single patient.
 *
 * @param req.query.cxId - The CX ID.
 * @param req.query.database - The database.
 * @param req.query.schema - The schema.
 */
router.post(
  "/manual-core-transform",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getFromQueryOrFail("cxId", req);
    const database = getFromQueryOrFail("database", req);
    const schema = getFromQueryOrFail("schema", req);

    // Remove this once we validate the flow, this should be triggered through POST /internal/analytics-platform/ingestion/core/rebuild
    const jobId = await startCoreTransform({ cxId, database, schema });

    return res.status(httpStatus.OK).json({ message: "Core transform initiated", jobId });
  })
);

/**
 * POST /internal/analytics-platform/ingestion/core/rebuild
 *
 * Rebuild the core schema from the raw, flattened data (result of FhirToCsv).
 *
 * @param req.query.cxId - The CX ID (optional, defaults to all cxIds that have the analytics
 *     incremental ingestion feature flag enabled).
 * @returns 200 OK with the cxIds that core schema rebuild was initiated for.
 */
router.post(
  "/ingestion/core/rebuild",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getFromQuery("cxId", req);

    const cxIds = await rebuildCoreSchemas({ cxId });

    const message = `Core schema rebuild initiated for ${cxIds.length} cxIds`;
    return res.status(httpStatus.OK).json({ message, cxIds });
  })
);

export default router;
