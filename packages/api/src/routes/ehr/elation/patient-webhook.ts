import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { syncElationPatientIntoMetriport } from "../../../external/ehr/elation/command/sync-patient";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFrom, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * POST /ehr/webhook/elation/patient/:id/appointment-created
 *
 * Tries to retrieve the matching Metriport patient on appointment created
 * @param req.params.id The ID of Elation Patient.
 * @returns Metriport Patient if found.
 */
router.post(
  "/:id/appointment-created",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const elationPatientId = getFrom("params").orFail("id", req);
    const elationPracticeId = getFromQueryOrFail("practiceId", req);
    const patientId = await syncElationPatientIntoMetriport({
      cxId,
      elationPracticeId,
      elationPatientId,
      triggerDq: true,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

export default router;
