import { buildCqlTransformHandler } from "@metriport/core/command/analytics-platform/cql-engine/command/cql-transform/cql-transform-factory";
import { setupCustomerAnalyticsFwh } from "@metriport/core/command/analytics-platform/fwh/setup-cx-fwh";
import { incrementalIngestPatient } from "@metriport/core/command/analytics-platform/incremental-ingest-patient";
import { rebuildCore } from "@metriport/core/command/analytics-platform/rebuild-core";
import { rebuildCoreIncremental } from "@metriport/core/command/analytics-platform/rebuild-core-incremental";
import { out } from "@metriport/core/util";
import { buildDayjs } from "@metriport/shared/common/date";
import {
  cqlParametersSchema,
  executionModeSchema,
} from "@metriport/shared/domain/cql-engine/transform";
import dayjs from "dayjs";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { z } from "zod";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getFromQuery, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * POST /internal/analytics-platform/enable
 *
 * Enables the analytics platform for a customer:
 * - Adds the CX to the feature flag for analytics incremental ingestion.
 * - Creates the customer analytics database in the main analytics DB instance.
 * - Creates the lambda/batch users.
 *
 * @param req.query.cxId - The CX ID.
 * @returns 200 OK
 */
router.post(
  "/enable",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getFromQueryOrFail("cxId", req);

    await setupCustomerAnalyticsFwh({ cxId });

    return res
      .status(httpStatus.OK)
      .json({ message: `Analytics platform enabled for cx ${cxId}`, cxId });
  })
);

/**
 * POST /internal/analytics-platform/ingestion/incremental
 *
 * Runs the incremental ingestion into the analytics platform, for a single patient.
 *
 * To be used for manual ingestion and development purposes. The regular flow is that
 * the incremental ingestion is triggered each time the patient's consolidated bundle
 * gets updated.
 *
 * @param req.query.cxId - The CX ID.
 * @param req.query.patientId - The patient ID.
 *
 * @returns 200 OK
 */
router.post(
  "/ingestion/incremental",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getFromQueryOrFail("cxId", req);
    const patientId = getFromQueryOrFail("patientId", req);

    await getPatientOrFail({ id: patientId, cxId });

    const jobId = await incrementalIngestPatient({ cxId, patientId });

    if (!jobId) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ message: "Ingestion not initiated - not enabled for cx?" });
    }
    return res.status(httpStatus.OK).json({ message: "Ingestion initiated", jobId });
  })
);

/**
 * POST /internal/analytics-platform/core/rebuild
 *
 * Rebuild the core schema with full refresh from the raw, flattened data (result of FhirToCsv).
 *
 * @param req.query.cxId - The CX ID.
 * @returns 200 OK with the jobId of the core schema rebuild.
 */
router.post(
  "/core/rebuild",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getFromQueryOrFail("cxId", req);

    const jobId = await rebuildCore({ cxId });

    return res.status(httpStatus.OK).json({ message: "Core schema rebuild initiated", jobId });
  })
);

/**
 * POST /internal/analytics-platform/core/incremental
 *
 * Rebuild the core schema incrementally from the raw, flattened data (result of FhirToCsv).
 *
 * Called by a scheduled lambda to trigger the batch job.
 *
 * @param req.query.cxId - The CX ID (optional, defaults to all cxIds that have the analytics
 *     incremental raw to core feature flag enabled).
 * @param req.query.lookbackTimestamp - The lookback timestamp (ISO 8601 format).
 * @param req.query.lookbackHours - The lookback hours.
 * @param req.query.delay - The delay in milliseconds.
 *
 * If both lookbackTimestamp and lookbackHours are provided, the lookback timestamp will be used.
 * If only lookbackHours is provided, the lookback timestamp will be the current time minus the lookback hours.
 * If neither are provided, the lookback will be 1 hour ago.
 *
 * @returns 200 OK with the cxIds that core schema rebuild was initiated for.
 */
router.post(
  "/core/incremental",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getFromQuery("cxId", req);
    const lookbackTimestampParam = getFromQuery("lookbackTimestamp", req);
    const lookbackHoursParams = getFromQuery("lookbackHours", req);
    const delayParams = getFromQuery("delay", req);

    const lookbackTimestamp = lookbackTimestampParam
      ? buildDayjs(lookbackTimestampParam)
      : undefined;
    const lookbackHours = lookbackHoursParams ? parseInt(lookbackHoursParams) : undefined;
    const delay = delayParams ? Number(delayParams) : undefined;
    if (delay !== undefined && (!Number.isFinite(delay) || delay < 0)) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ message: "delay must be a non-negative number (ms)" });
    }

    const { successful, failed } = await rebuildCoreIncremental({
      cxId,
      ...(lookbackTimestamp !== undefined && { lookbackTimestamp }),
      ...(lookbackHours !== undefined && { lookbackHours }),
      ...(delay !== undefined && { delay: dayjs.duration(delay, "milliseconds") }),
    });

    const message = `Core schema rebuild initiated for ${successful.length} cxIds`;
    if (failed.length > 0) {
      out("").log(
        `Failed to initiate rebuilding core schema incrementally for ${
          failed.length
        } cxIds: ${failed.join(", ")}`
      );
    }
    return res.status(httpStatus.OK).json({ message, successful, failed });
  })
);

const cqlTransformBodySchema = z.object({
  cqlJobId: z.string().optional(),
  patientBundleS3Key: z.string(),
  mode: executionModeSchema.optional(),
  parameters: cqlParametersSchema.optional(),
});

/**
 * POST /internal/analytics-platform/cql-transform
 *
 * Runs the CQL transform into the analytics platform, for a single patient.
 *
 * @param req.query.cxId - The CX ID.
 * @param req.query.patientId - The patient ID.
 * @param req.body.cqlJobId - The CQL job ID.
 * @param req.body.patientBundleS3Key - The patient bundle S3 key.
 * @returns 200 OK
 */
router.post(
  "/cql-transform",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getFromQueryOrFail("cxId", req);
    const patientId = getFromQueryOrFail("patientId", req);
    const { cqlJobId, patientBundleS3Key, mode, parameters } = cqlTransformBodySchema.parse(
      req.body
    );

    const cqlTransformHandler = buildCqlTransformHandler();
    const jobId = await cqlTransformHandler.processCqlTransform({
      cxId,
      patientId,
      jobId: cqlJobId,
      patientBundleS3Key,
      mode,
      parameters,
    });

    return res.status(httpStatus.OK).json({ message: "CqlTransform initiated", jobId });
  })
);

export default router;
