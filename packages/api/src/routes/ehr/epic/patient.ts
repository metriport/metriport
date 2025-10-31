import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { syncEpicPatientIntoMetriport } from "../../../external/ehr/epic/command/sync-patient";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFrom, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * GET /ehr/epic/patient/:id
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of Epic Patient.
 * @param req.query.practiceId The ID of Epic Practice.
 * @param req.query.instanceUrl The Epic instance URL.
 * @param req.query.tokenId The ID of Epic Token.
 * @returns Metriport Patient if found.
 */
router.get(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const epicPatientId = getFrom("params").orFail("id", req);
    const epicPracticeId = getFromQueryOrFail("practiceId", req);
    const epicInstanceUrl = getFromQueryOrFail("instanceUrl", req);
    const epicTokenId = getFromQueryOrFail("tokenId", req);
    const patientId = await syncEpicPatientIntoMetriport({
      cxId,
      epicPracticeId,
      epicPatientId,
      epicInstanceUrl,
      epicTokenId,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

/**
 * POST /ehr/epic/patient/:id
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of Epic Patient.
 * @param req.query.practiceId The ID of Epic Practice.
 * @param req.query.instanceUrl The Epic instance URL.
 * @param req.query.tokenId The ID of Epic Token.
 * @returns Metriport Patient if found.
 */
router.post(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const epicPatientId = getFrom("params").orFail("id", req);
    const epicPracticeId = getFromQueryOrFail("practiceId", req);
    const epicInstanceUrl = getFromQueryOrFail("instanceUrl", req);
    const epicTokenId = getFromQueryOrFail("tokenId", req);
    const patientId = await syncEpicPatientIntoMetriport({
      cxId,
      epicPracticeId,
      epicPatientId,
      epicInstanceUrl,
      epicTokenId,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

export default router;
