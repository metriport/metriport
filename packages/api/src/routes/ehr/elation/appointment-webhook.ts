import { buildEhrSyncPatientHandler } from "@metriport/core/external/ehr/sync-patient/ehr-sync-patient-factory";
import { out } from "@metriport/core/util/log";
import { MetriportError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { elationSecondaryMappingsSchema } from "@metriport/shared/interface/external/ehr/elation/cx-mapping";
import { elationAppointmentEventSchema } from "@metriport/shared/interface/external/ehr/elation/event";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { getCxMappingOrFail } from "../../../command/mapping/cx";
import { createOrUpdateElationPatientMetadata } from "../../../external/ehr/elation/command/sync-patient";
import { elationWebhookCreatedDateDiffSeconds } from "../../../external/ehr/elation/shared";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * POST /ehr/webhook/elation/appointments
 *
 * Tries to retrieve the matching Metriport patient on appointment created
 * @returns HTTP 200 OK on successful processing.
 */
router.post(
  "/",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const elationPracticeId = getFromQueryOrFail("practiceId", req);
    const event = elationAppointmentEventSchema.parse(req.body);
    const { log } = out(`${req.method} ${req.url} ${cxId} ${elationPracticeId} ${event.event_id}`);
    if (event.action === "deleted") {
      log(`Appointment event is a deleted event for appointment ${event.data.id}`);
      return res.sendStatus(httpStatus.OK);
    }
    const diff = buildDayjs(event.data.last_modified_date).diff(
      buildDayjs(event.data.created_date),
      "second"
    );
    if (diff > elationWebhookCreatedDateDiffSeconds.asSeconds()) {
      log(`Appointment event is not a created event for appointment ${event.data.id}`);
      return res.sendStatus(httpStatus.OK);
    }
    const cxMapping = await getCxMappingOrFail({
      externalId: elationPracticeId,
      source: EhrSources.elation,
    });
    if (!cxMapping.secondaryMappings) {
      throw new MetriportError("Elation secondary mappings not found", undefined, {
        externalId: elationPracticeId,
        source: EhrSources.elation,
      });
    }
    const secondaryMappings = elationSecondaryMappingsSchema.parse(cxMapping.secondaryMappings);
    if (secondaryMappings.webhookAppointmentPatientLinkingDisabled) {
      return res.sendStatus(httpStatus.OK);
    }
    await createOrUpdateElationPatientMetadata({
      cxId,
      elationPracticeId,
      elationPatientId: event.data.patient,
    });
    if (secondaryMappings.webhookAppointmentPatientProcessingDisabled) {
      return res.sendStatus(httpStatus.OK);
    }
    const handler = buildEhrSyncPatientHandler();
    await handler.processSyncPatient({
      ehr: EhrSources.elation,
      cxId,
      practiceId: elationPracticeId,
      patientId: event.data.patient,
      triggerDq: true,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
