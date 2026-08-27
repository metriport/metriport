import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { syncEmbedPatientIntoMetriport } from "../../../external/ehr/embed/command/sync-patient";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFrom, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * GET /ehr/embed/patient/:id
 *
 * NOTE: Unlike other EHRs, embedPatientId is a metriportPatientId, we simply check:
 * 1. if patient exist, else throw.
 * 2. if patient_mapping exists (to satify current EHR patterns), else create one.
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of Metriport Patient.
 * @param req.query.practiceId The ID of Embed Practice.
 * @returns Metriport Patient ID if found.
 */
router.get(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const embedPatientId = getFrom("params").orFail("id", req);
    const embedPracticeId = getFromQueryOrFail("practiceId", req);
    const patientId = await syncEmbedPatientIntoMetriport({
      cxId,
      embedPracticeId,
      embedPatientId,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

export default router;
