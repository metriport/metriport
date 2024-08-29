import Router from "express-promise-router";
import httpStatus from "http-status";
import { Request, Response } from "express";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { getConsolidatedPatientData } from "../../../command/medical/patient/consolidated-get";
import { getPatient } from "../../../external/ehr/athenahealth/command/get-patient";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFrom } from "../../util";
import { getAuthorizationToken } from "../../util";
import { getResourcesQueryParam } from "../../medical/schemas/fhir";
import { parseISODate } from "../../../shared/date";

const router = Router();

/**
 * GET /ehr/athenahealth/patient/:id
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of AthenaHealth Patient.
 * @returns Metriport Patient if found.
 */
router.get(
  "/:id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const accessToken = getAuthorizationToken(req);
    const cxId = getCxIdOrFail(req);
    const athenaPatientId = getFrom("params").orFail("id", req);
    const patient = await getPatient({
      accessToken,
      cxId,
      athenaPatientId,
    });
    return res.status(httpStatus.OK).json(patient);
  })
);

/**
 * GET /ehr/athenahealth/patient/:id/consolidated
 *
 * Returns a patient's consolidated data.
 *
 * @param req.cxId The customer ID.
 * @param req.param.id The  ID of the Metriport Patient whose data is to be returned.
 * @param req.query.resources Optional comma-separated list of resources to be returned.
 * @param req.query.dateFrom Optional start date that resources will be filtered by (inclusive).
 * @param req.query.dateTo Optional end date that resources will be filtered by (inclusive).
 * @return Metriport Patient's consolidated data.
 */
router.get(
  "/:id/consolidated",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const metriportPatientId = getFrom("params").orFail("id", req);
    const resources = getResourcesQueryParam(req);
    const dateFrom = parseISODate(getFrom("query").optional("dateFrom", req));
    const dateTo = parseISODate(getFrom("query").optional("dateTo", req));
    const patient = await getPatientOrFail({ id: metriportPatientId, cxId });

    const data = await getConsolidatedPatientData({
      patient,
      resources,
      dateFrom,
      dateTo,
    });

    return res.json(data);
  })
);

export default router;
