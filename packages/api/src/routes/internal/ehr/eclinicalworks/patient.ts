import { processAsyncError } from "@metriport/core/util/error/shared";
import { Request, Response } from "express";
import { out } from "@metriport/core/util/log";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { syncEclinicalworksPatientIntoMetriport } from "../../../../external/ehr/eclinicalworks/command/sync-patient";
import { requestLogger } from "../../../helpers/request-logger";
import { getUUIDFrom } from "../../../schemas/uuid";
import { asyncHandler, getFromQueryAsBoolean, getFromQueryOrFail } from "../../../util";

const router = Router();

/**
 * POST /internal/ehr/eclinicalworks/patient
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.query.cxId The ID of Metriport Customer.
 * @param req.query.patientId The ID of Eclinicalworks Patient.
 * @param req.query.practiceId The ID of Eclinicalworks Practice.
 * @param req.query.tokenId The ID of Eclinicalworks Token.
 * @param req.query.triggerDq Whether to trigger a data quality check.
 * @returns 200 OK
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const eclinicalworksPatientId = getFromQueryOrFail("patientId", req);
    const eclinicalworksPracticeId = getFromQueryOrFail("practiceId", req);
    const eclinicalworksTokenId = getFromQueryOrFail("tokenId", req);
    const triggerDq = getFromQueryAsBoolean("triggerDq", req);
    syncEclinicalworksPatientIntoMetriport({
      cxId,
      eclinicalworksPracticeId,
      eclinicalworksPatientId,
      eclinicalworksTokenId,
      triggerDq,
    })
      .then(() => out().log(`Completed Eclinicalworks sync for patient ${eclinicalworksPatientId}`))
      .catch(processAsyncError("Eclinicalworks syncEclinicalworksPatientIntoMetriport"));
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
