import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { writeConditionToChart } from "../../../external/ehr/elation/command/write-condition-to-chart";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFrom, getFromQueryOrFail } from "../../util";
import { processEhrPatientId } from "../shared";
import { tokenEhrPatientIdQueryParam } from "./auth/middleware";

const router = Router();

/**
 * POST /ehr/elation/chart/:id/condition
 *
 * Writes the condition to the patient's chart
 * @param req.params.id The ID of Elation Patient.
 * @param req.query.practiceId The ID of Elation Practice.
 * @param req.body The FHIR Resource payload
 * @returns Elation API response
 */
router.post(
  "/:id/condition",
  handleParams,
  processEhrPatientId(tokenEhrPatientIdQueryParam, "params"),
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const elationPatientId = getFrom("params").orFail("id", req);
    const elationPracticeId = getFromQueryOrFail("practiceId", req);
    const payload = req.body; // TODO Parse body https://github.com/metriport/metriport-internal/issues/2170
    const conditionDetails = await writeConditionToChart({
      cxId,
      elationPatientId,
      elationPracticeId,
      condition: payload,
    });
    return res.status(httpStatus.OK).json(conditionDetails);
  })
);

export default router;
