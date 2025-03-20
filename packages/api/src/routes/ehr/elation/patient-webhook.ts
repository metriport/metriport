import { elationPatientEventSchema } from "@metriport/shared/interface/external/ehr/elation/event";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { createOrUpdateElationPatientMetadata } from "../../../external/ehr/elation/command/sync-patient";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFromQueryOrFail } from "../../util";

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
    if (event.action === "deleted") {
      console.log(`Patient event is a deleted event for patient ${event.data.id}`);
      return res.sendStatus(httpStatus.OK);
    }
    if (event.data.created_date !== event.data.last_modified_date) {
      console.log(`Patient event is not a created event for patient ${event.data.id}`);
      return res.sendStatus(httpStatus.OK);
    }
    await createOrUpdateElationPatientMetadata({
      cxId,
      elationPracticeId,
      elationPatientId: event.data.id,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
