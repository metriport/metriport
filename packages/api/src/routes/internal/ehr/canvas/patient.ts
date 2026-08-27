import { processAsyncError } from "@metriport/core/util/error/shared";
import { MetriportError } from "@metriport/shared";
import { canvasSecondaryMappingsSchema } from "@metriport/shared/interface/external/ehr/canvas/cx-mapping";
import { externalEventDataSchema } from "@metriport/shared/interface/external/ehr/canvas/external-event";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { getCxMappingsByCustomer } from "../../../../command/mapping/cx";
import { processPatientsFromAppointments } from "../../../../external/ehr/canvas/command/process-patients-from-appointments";
import { sendAdtToCanvas } from "../../../../external/ehr/canvas/command/send-adt";
import { syncCanvasPatientIntoMetriport } from "../../../../external/ehr/canvas/command/sync-patient";
import { requestLogger } from "../../../helpers/request-logger";
import { getUUIDFrom } from "../../../schemas/uuid";
import { asyncHandler, getFromQueryAsBoolean, getFromQueryOrFail } from "../../../util";

const router = Router();

/**
 * POST /internal/ehr/canvas/patient/appointments
 *
 * Fetches appointments in the time range and creates all patients not already existing
 * @returns 200 OK
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
 * @param req.query.isAppointment Whether triggered via an appointment (optional).
 * @returns 200 OK
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const canvasPatientId = getFromQueryOrFail("patientId", req);
    const canvasPracticeId = getFromQueryOrFail("practiceId", req);
    const triggerDq = getFromQueryAsBoolean("triggerDq", req);
    const isAppointment = getFromQueryAsBoolean("isAppointment", req);
    syncCanvasPatientIntoMetriport({
      cxId,
      canvasPracticeId,
      canvasPatientId,
      triggerDq,
      triggerDqForExistingPatient: isAppointment,
    }).catch(processAsyncError("Canvas syncCanvasPatientIntoMetriport"));
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/ehr/canvas/patient/adt
 *
 * Sends ADT event to Canvas ExternalEvent API.
 * @param req.query.cxId Customer ID.
 * @param req.query.patientId Metriport patient ID.
 * @param req.body ADT event data.
 * @returns 200 OK
 */
router.post(
  "/adt",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFromQueryOrFail("patientId", req);
    const adtData = externalEventDataSchema.parse(req.body);
    const cxMappings = await getCxMappingsByCustomer({ cxId, source: EhrSources.canvas });
    const cxMapping = cxMappings[0];
    if (!cxMapping) {
      throw new MetriportError("Canvas cx mappings not found", undefined, {
        cxId,
        patientId,
      });
    }
    if (cxMappings.length > 1) {
      throw new MetriportError("Multiple Canvas cx mappings found", undefined, {
        cxId,
        source: EhrSources.canvas,
      });
    }
    const practiceId = cxMapping.externalId;
    if (!cxMapping.secondaryMappings) {
      throw new MetriportError("Canvas secondary mappings not found", undefined, {
        cxId,
        externalId: practiceId,
        source: EhrSources.canvas,
      });
    }
    const secondaryMappings = canvasSecondaryMappingsSchema.parse(cxMapping.secondaryMappings);
    if (!secondaryMappings.adtProcessingEnabled) {
      throw new MetriportError("Canvas ADT processing not enabled", undefined, {
        cxId,
        patientId,
        practiceId,
        eventType: adtData.eventType,
      });
    }
    sendAdtToCanvas({
      cxId,
      patientId,
      practiceId,
      ...adtData,
    }).catch(processAsyncError("Canvas sendAdtToCanvas"));
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
