import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { syncTouchWorksPatientIntoMetriport } from "../../../external/ehr/touchworks/command/sync-patient";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFrom, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * GET /ehr/touchworks/patient/:id
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of TouchWorks Patient.
 * @param req.query.practiceId The ID of TouchWorks Practice.
 * @param req.query.tokenId The ID of TouchWorks Token.
 * @returns Metriport Patient if found.
 */
router.get(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const touchworksPatientId = getFrom("params").orFail("id", req);
    const touchworksPracticeId = getFromQueryOrFail("practiceId", req);
    const touchworksTokenId = getFromQueryOrFail("tokenId", req);
    const patientId = await syncTouchWorksPatientIntoMetriport({
      cxId,
      touchworksPracticeId,
      touchworksPatientId,
      touchworksTokenId,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

/**
 * POST /ehr/touchworks/patient/:id
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of TouchWorks Patient.
 * @param req.query.practiceId The ID of TouchWorks Practice.
 * @param req.query.tokenId The ID of TouchWorks Token.
 * @returns Metriport Patient if found.
 */
router.post(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const touchworksPatientId = getFrom("params").orFail("id", req);
    const touchworksPracticeId = getFromQueryOrFail("practiceId", req);
    const touchworksTokenId = getFromQueryOrFail("tokenId", req);
    const patientId = await syncTouchWorksPatientIntoMetriport({
      cxId,
      touchworksPracticeId,
      touchworksPatientId,
      touchworksTokenId,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

export default router;
