import { elationPatientEventSchema } from "@metriport/shared/interface/external/ehr/elation/event";
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
 * POST /ehr/webhook/elation/patients
 *
 * Tries to update or create the Elation patient metadata
 * @returns HTTP 200 OK on successful processing.
 */
router.post(
  "/",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const elationPracticeId = getFromQueryOrFail("practiceId", req);
    const event = elationPatientEventSchema.parse(req.body);
    if (event.action === "deleted") return res.sendStatus(httpStatus.OK);
    updateOrCreateElationPatientMetadata({
      cxId,
      elationPracticeId,
      elationPatientId: event.data.id,
    }).catch(processAsyncError("Elation updateOrCreateElationPatientMetadata"));
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
