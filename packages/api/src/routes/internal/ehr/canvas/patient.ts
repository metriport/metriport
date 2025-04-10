import { processAsyncError } from "@metriport/core/util/error/shared";
import { BadRequestError } from "@metriport/shared";
import { fhirResourceSchema } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { isResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { z } from "zod";
import { processPatientsFromAppointments } from "../../../../external/ehr/canvas/command/process-patients-from-appointments";
import { computeCanvasResourceDiff } from "../../../../external/ehr/canvas/command/resource-diff/compute-resource-diff";
import { fetchCanvasOrMetriportResources } from "../../../../external/ehr/canvas/command/resource-diff/fetch-resources";
import { saveCanvasResourceDiff } from "../../../../external/ehr/canvas/command/resource-diff/save-resource-diff";
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
 * @param req.params.id The ID of Canvas Patient.
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
 * GET /internal/ehr/canvas/patient/fetch-resources
 *
 * Fetches the resources for the canvas patient
 * @returns Resources
 */
router.post(
  "/compute-resource-diff",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const canvasPatientId = getFromQueryOrFail("patientId", req);
    const canvasPracticeId = getFromQueryOrFail("practiceId", req);
    const resourceType = getFromQueryOrFail("resourceType", req);
    const direction = getFromQueryOrFail("direction", req);
    const useS3 = getFromQueryAsBoolean("useS3", req);
    if (!isResourceDiffDirection(direction)) {
      throw new BadRequestError("Invalid direction", undefined, { direction });
    }
    const resources = await fetchCanvasOrMetriportResources({
      cxId,
      canvasPracticeId,
      canvasPatientId,
      resourceType,
      direction,
      useS3,
    });
    return res.status(httpStatus.OK).json(resources);
  })
);

const conputeResourceSchema = z.object({
  newResource: fhirResourceSchema,
  existingResources: fhirResourceSchema.array(),
});

/**
 * POST /internal/ehr/canvas/patient/compute-resource-diff
 *
 * Computes the resource diff for the canvas patient asynchronously
 * @returns 200 OK
 */
router.post(
  "/compute-resource-diff",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const canvasPatientId = getFromQueryOrFail("patientId", req);
    const direction = getFromQueryOrFail("direction", req);
    const { existingResources, newResource } = conputeResourceSchema.parse(req.body);
    if (!isResourceDiffDirection(direction)) {
      throw new BadRequestError("Invalid direction", undefined, { direction });
    }
    computeCanvasResourceDiff({
      cxId,
      canvasPatientId,
      newResource,
      existingResources,
      direction,
    }).catch(processAsyncError("Canvas computeCanvasResourceDiff"));
    return res.sendStatus(httpStatus.OK);
  })
);

const saveResourceSchema = z.object({
  matchedResourceIds: z.string().array(),
});

/**
 * POST /internal/ehr/canvas/patient/save-resource-diff
 *
 * Saves the resource diff for the canvas patient asynchronously
 * @returns 200 OK
 */
router.post(
  "/save-resource-diff",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const canvasPatientId = getFromQueryOrFail("patientId", req);
    const resourceId = getFromQueryOrFail("resourceId", req);
    const { matchedResourceIds } = saveResourceSchema.parse(req.body);
    const direction = getFromQueryOrFail("direction", req);
    if (!isResourceDiffDirection(direction)) {
      throw new BadRequestError("Invalid direction", undefined, { direction });
    }
    saveCanvasResourceDiff({
      cxId,
      canvasPatientId,
      resourceId,
      matchedResourceIds,
      direction,
    }).catch(processAsyncError("Canvas saveCanvasResourceDiff"));
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
