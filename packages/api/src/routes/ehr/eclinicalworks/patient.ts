import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { syncEclinicalworksPatientIntoMetriport } from "../../../external/ehr/eclinicalworks/command/sync-patient";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFrom, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * GET /ehr/eclinicalworks/patient/:id
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of Eclinicalworks Patient.
 * @param req.query.practiceId The ID of Eclinicalworks Practice.
 * @param req.query.aud The ID of Eclinicalworks Aud.
 * @returns Metriport Patient if found.
 */
router.get(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const eclinicalworksPatientId = getFrom("params").orFail("id", req);
    const eclinicalworksPracticeId = getFromQueryOrFail("practiceId", req);
    const eclinicalworksTokenId = getFromQueryOrFail("tokenId", req);
    const patientId = await syncEclinicalworksPatientIntoMetriport({
      cxId,
      eclinicalworksPracticeId,
      eclinicalworksPatientId,
      eclinicalworksTokenId,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

/**
 * POST /ehr/eclinicalworks/patient/:id
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of Eclinicalworks Patient.
 * @param req.query.practiceId The ID of Eclinicalworks Practice.
 * @param req.query.aud The ID of Eclinicalworks Aud.
 * @returns Metriport Patient if found.
 */
router.post(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const eclinicalworksPatientId = getFrom("params").orFail("id", req);
    const eclinicalworksPracticeId = getFromQueryOrFail("practiceId", req);
    const eclinicalworksTokenId = getFromQueryOrFail("tokenId", req);
    const patientId = await syncEclinicalworksPatientIntoMetriport({
      cxId,
      eclinicalworksPracticeId,
      eclinicalworksPatientId,
      eclinicalworksTokenId,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

export default router;
