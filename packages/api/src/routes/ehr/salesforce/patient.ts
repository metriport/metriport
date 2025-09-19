import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { syncSalesforcePatientIntoMetriport } from "../../../external/ehr/salesforce/command/sync-patient";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFrom, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * GET /ehr/salesforce/patient/:id
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of Salesforce Patient.
 * @param req.query.sfOrgId The ID of Salesforce Organization.
 * @param req.query.sfInstanceUrl The Salesforce instance URL.
 * @param req.query.tokenId The ID of Salesforce Token.
 * @returns Metriport Patient if found.
 */
router.get(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const salesforcePatientId = getFrom("params").orFail("id", req);
    const salesforceOrgId = getFromQueryOrFail("sfOrgId", req);
    const salesforceInstanceUrl = getFromQueryOrFail("sfInstanceUrl", req);
    const salesforceTokenId = getFromQueryOrFail("tokenId", req);
    const patientId = await syncSalesforcePatientIntoMetriport({
      cxId,
      salesforceOrgId,
      salesforcePatientId,
      salesforceInstanceUrl,
      salesforceTokenId,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

/**
 * POST /ehr/salesforce/patient/:id
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of Salesforce Patient.
 * @param req.query.sfOrgId The ID of Salesforce Organization.
 * @param req.query.sfInstanceUrl The Salesforce instance URL.
 * @param req.query.tokenId The ID of Salesforce Token.
 * @returns Metriport Patient if found.
 */
router.post(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const salesforcePatientId = getFrom("params").orFail("id", req);
    const salesforceOrgId = getFromQueryOrFail("sfOrgId", req);
    const salesforceInstanceUrl = getFromQueryOrFail("sfInstanceUrl", req);
    const salesforceTokenId = getFromQueryOrFail("tokenId", req);
    const patientId = await syncSalesforcePatientIntoMetriport({
      cxId,
      salesforceOrgId,
      salesforcePatientId,
      salesforceInstanceUrl,
      salesforceTokenId,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

export default router;
