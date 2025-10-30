import { buildEhrSyncPatientHandler } from "@metriport/core/external/ehr/command/sync-patient/ehr-sync-patient-factory";
import { MetriportError } from "@metriport/shared";
import { canvasSecondaryMappingsSchema } from "@metriport/shared/interface/external/ehr/canvas/cx-mapping";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { getCxMappingOrFail } from "../../../command/mapping/cx";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFrom, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * POST /ehr/webhook/canvas/patient/:id/appointment-created
 *
 * Tries to retrieve the matching Metriport patient on appointment created
 * @param req.params.id The ID of Canvas Patient.
 * @returns HTTP 200 OK on successful processing.
 */
router.post(
  "/:id/appointment-created",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const canvasPatientId = getFrom("params").orFail("id", req);
    const canvasPracticeId = getFromQueryOrFail("practiceId", req);
    const handler = buildEhrSyncPatientHandler();
    await handler.processSyncPatient({
      ehr: EhrSources.canvas,
      cxId,
      practiceId: canvasPracticeId,
      patientId: canvasPatientId,
      triggerDq: true,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /ehr/webhook/canvas/patient/:id/patient-created
 *
 * Tries to retrieve the matching Metriport patient on patient created
 * @param req.params.id The ID of Canvas Patient.
 * @returns HTTP 200 OK on successful processing.
 */
router.post(
  "/:id/patient-created",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const canvasPatientId = getFrom("params").orFail("id", req);
    const canvasPracticeId = getFromQueryOrFail("practiceId", req);
    const cxMapping = await getCxMappingOrFail({
      externalId: canvasPracticeId,
      source: EhrSources.canvas,
    });
    if (!cxMapping.secondaryMappings) {
      throw new MetriportError("Canvas secondary mappings not found", undefined, {
        externalId: canvasPracticeId,
        source: EhrSources.canvas,
      });
    }
    const secondaryMappings = canvasSecondaryMappingsSchema.parse(cxMapping.secondaryMappings);
    if (secondaryMappings?.webhookPatientPatientLinkingDisabled) {
      return res.sendStatus(httpStatus.OK);
    }
    if (secondaryMappings?.webhookPatientPatientProcessingEnabled) {
      const handler = buildEhrSyncPatientHandler();
      await handler.processSyncPatient({
        ehr: EhrSources.canvas,
        cxId,
        practiceId: canvasPracticeId,
        patientId: canvasPatientId,
        triggerDq: true,
      });
    }
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
