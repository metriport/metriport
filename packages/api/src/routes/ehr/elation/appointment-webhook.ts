import { buildEhrSyncPatientHandler } from "@metriport/core/external/ehr/sync-patient/ehr-sync-patient-factory";
import { elationAppointmentEventSchema } from "@metriport/shared/interface/external/ehr/elation/event";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { updateOrCreateElationPatientMetadata } from "../../../external/ehr/elation/command/sync-patient";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFromQueryOrFail } from "../../util";
import { processAsyncError } from "../../../errors";

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
    if (event.action === "deleted") return res.sendStatus(httpStatus.OK);
    const handler = buildEhrSyncPatientHandler();
    updateOrCreateElationPatientMetadata({
      cxId,
      elationPracticeId,
      elationPatientId: event.data.patient,
    }).catch(processAsyncError("Elation updateOrCreateElationPatientMetadata"));
    handler
      .processSyncPatient({
        ehr: EhrSources.elation,
        cxId,
        practiceId: elationPracticeId,
        patientId: event.data.patient,
        triggerDq: true,
      })
      .catch(processAsyncError("Elation processSyncPatient"));
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
