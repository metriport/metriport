import { buildEhrSyncPatientHandler } from "@metriport/core/external/ehr/command/sync-patient/ehr-sync-patient-factory";
import { MetriportError } from "@metriport/shared";
import { healthieSecondaryMappingsSchema } from "@metriport/shared/interface/external/ehr/healthie/cx-mapping";
import { healthiePatientCreatedEventSchema } from "@metriport/shared/interface/external/ehr/healthie/event";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { getCxMappingOrFail } from "../../../command/mapping/cx";
import { updateHealthiePatientQuickNotes } from "../../../external/ehr/healthie/command/sync-patient";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * POST /ehr/webhook/healthie/:practiceId/patient/created
 *
 * Tries to update the Healthie patient quick notes
 * @returns HTTP 200 OK on successful processing.
 */
router.post(
  "/created",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const healthiePracticeId = getFromQueryOrFail("practiceId", req);
    const event = healthiePatientCreatedEventSchema.parse(req.body);
    const cxMapping = await getCxMappingOrFail({
      externalId: healthiePracticeId,
      source: EhrSources.healthie,
    });
    if (!cxMapping.secondaryMappings) {
      throw new MetriportError("Healthie secondary mappings not found", undefined, {
        externalId: healthiePracticeId,
        source: EhrSources.healthie,
      });
    }
    const secondaryMappings = healthieSecondaryMappingsSchema.parse(cxMapping.secondaryMappings);
    if (secondaryMappings.webhookPatientPatientLinkingDisabled) {
      return res.sendStatus(httpStatus.OK);
    }
    await updateHealthiePatientQuickNotes({
      cxId,
      healthiePracticeId,
      healthiePatientId: event.resource_id,
    });
    if (secondaryMappings.webhookPatientPatientProcessingEnabled) {
      const handler = buildEhrSyncPatientHandler();
      await handler.processSyncPatient({
        ehr: EhrSources.healthie,
        cxId,
        practiceId: healthiePracticeId,
        patientId: event.resource_id,
        triggerDq: true,
      });
    }
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
