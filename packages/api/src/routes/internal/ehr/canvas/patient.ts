import { isSupportedCanvasDiffResource } from "@metriport/core/external/ehr/canvas/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { BadRequestError } from "@metriport/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { fetchCanvasBundle } from "../../../../external/ehr/canvas/command/bundle/fetch-ehr-bundle";
import { refreshCanvasBundles } from "../../../../external/ehr/canvas/command/bundle/refresh-ehr-bundles";
import { processPatientsFromAppointments } from "../../../../external/ehr/canvas/command/process-patients-from-appointments";
import { syncCanvasPatientIntoMetriport } from "../../../../external/ehr/canvas/command/sync-patient";
import { requestLogger } from "../../../helpers/request-logger";
import { getUUIDFrom } from "../../../schemas/uuid";
import { asyncHandler, getFromQueryAsBoolean, getFromQueryOrFail } from "../../../util";

const router = Router();

/**
 * POST /internal/ehr/canvas/patient/appointments
 *
 * Fetches appointments in the time range and creates all patients not already existing
 */
router.post(
  "/appointments",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    processPatientsFromAppointments().catch(
      processAsyncError("Canvas processPatientsFromAppointments")
    );
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/ehr/canvas/patient
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.query.cxId The cxId of the patient.
 * @param req.query.patientId The ID of Canvas Patient.
 * @param req.query.practiceId The ID of Canvas Practice.
 * @param req.query.triggerDq Whether to trigger a DQ (optional).
 * @returns Metriport Patient if found.
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const canvasPatientId = getFromQueryOrFail("patientId", req);
    const canvasPracticeId = getFromQueryOrFail("practiceId", req);
    const triggerDq = getFromQueryAsBoolean("triggerDq", req);
    syncCanvasPatientIntoMetriport({
      cxId,
      canvasPracticeId,
      canvasPatientId,
      triggerDq,
    }).catch(processAsyncError("Canvas syncCanvasPatientIntoMetriport"));
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/ehr/canvas/patient/refresh-ehr-bundles
 *
 * Refreshes the cached bundles of resources in Canvas across all supported resource types.
 * @param req.query.cxId The cxId of the patient.
 * @param req.query.patientId The ID of Canvas Patient.
 * @param req.query.practiceId The ID of Canvas Practice.
 * @returns 200 OK
 */
router.post(
  "/refresh-ehr-bundles",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const canvasPatientId = getFromQueryOrFail("patientId", req);
    const canvasPracticeId = getFromQueryOrFail("practiceId", req);
    refreshCanvasBundles({
      cxId,
      canvasPracticeId,
      canvasPatientId,
    }).catch(processAsyncError("Canvas refreshCanvasBundles"));
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * GET /internal/ehr/canvas/patient/ehr-bundle
 *
 * Fetches the Canvas bundle for the canvas patient by resource type
 * @param req.query.cxId The cxId of the patient.
 * @param req.query.patientId The ID of Canvas Patient.
 * @param req.query.practiceId The ID of Canvas Practice.
 * @param req.query.resourceType The resource type to fetch
 * @param req.query.useCachedBundle Whether to use the cached bundle (optional)
 * @returns Canvas bundle
 */
router.get(
  "/ehr-bundle",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const canvasPatientId = getFromQueryOrFail("patientId", req);
    const canvasPracticeId = getFromQueryOrFail("practiceId", req);
    const resourceType = getFromQueryOrFail("resourceType", req);
    const useCachedBundle = getFromQueryAsBoolean("useCachedBundle", req);
    if (!isSupportedCanvasDiffResource(resourceType)) {
      throw new BadRequestError("Resource type is not supported for bundle", undefined, {
        resourceType,
      });
    }
    const bundle = await fetchCanvasBundle({
      cxId,
      canvasPracticeId,
      canvasPatientId,
      resourceType,
      useCachedBundle,
    });
    return res.status(httpStatus.OK).json(bundle);
  })
);

export default router;
