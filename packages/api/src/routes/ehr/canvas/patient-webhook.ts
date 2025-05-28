import { buildEhrSyncPatientHandler } from "@metriport/core/external/ehr/command/sync-patient/ehr-sync-patient-factory";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
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

export default router;
