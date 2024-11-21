import Router from "express-promise-router";
import httpStatus from "http-status";
import { Request, Response } from "express";
import { isTrue } from "@metriport/shared/common/boolean";
import { getPatientIdOrFail as getPatientIdFromAthenaPatientOrFail } from "../../../external/ehr/athenahealth/command/get-patient";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFrom, getFromQueryOrFail } from "../../util";
import { getAuthorizationToken } from "../../util";
import { handleParams } from "../../helpers/handle-params";
import { getHieOptOut, setHieOptOut } from "../../../command/medical/patient/update-hie-opt-out";
import { PatientHieOptOutResponse } from "../../medical/schemas/patient";

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
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const accessToken = getAuthorizationToken(req);
    const cxId = getCxIdOrFail(req);
    const athenaPatientId = getFrom("params").orFail("id", req);
    const athenaPracticeId = getFromQueryOrFail("practiceId", req);
    const patientId = await getPatientIdFromAthenaPatientOrFail({
      cxId,
      athenaPracticeId,
      athenaPatientId,
      accessToken,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

/** ---------------------------------------------------------------------------
 * PUT /patient/:id/hie-opt-out
 *
 * Returns whether the patient is opted out of networks.
 *
 * @param req.cxId The customer ID.
 * @param req.param.patientId The ID of the patient whose data is to be returned.
 * @param req.query.hieOptOut Boolean value to opt patient out or in.
 */
router.put(
  "/:id/hie-opt-out",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const accessToken = getAuthorizationToken(req);
    const cxId = getCxIdOrFail(req);
    const athenaPatientId = getFrom("params").orFail("id", req);
    const athenaPracticeId = getFromQueryOrFail("practiceId", req);
    const patientId = await getPatientIdFromAthenaPatientOrFail({
      cxId,
      athenaPracticeId,
      athenaPatientId,
      accessToken,
    });

    const hieOptOut = isTrue(getFrom("query").orFail("hieOptOut", req));

    const result = await setHieOptOut({ patientId, cxId, hieOptOut });

    const respPayload: PatientHieOptOutResponse = {
      id: result.id,
      hieOptOut: result.hieOptOut ?? false,
      message: `Patient has been opted ${result.hieOptOut ? "out from" : "in to"} the networks`,
    };

    return res.status(httpStatus.OK).json(respPayload);
  })
);

// TODO #2475 expose this on the patient
/** ---------------------------------------------------------------------------
 * GET /patient/:id/hie-opt-out
 *
 * Returns whether the patient is opted out of data pulling and sharing.
 *
 * @param req.cxId The customer ID.
 * @param req.param.patientId The ID of the patient whose data is to be returned.
 */
router.get(
  "/:id/hie-opt-out",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const accessToken = getAuthorizationToken(req);
    const cxId = getCxIdOrFail(req);
    const athenaPatientId = getFrom("params").orFail("id", req);
    const athenaPracticeId = getFromQueryOrFail("practiceId", req);
    const patientId = await getPatientIdFromAthenaPatientOrFail({
      cxId,
      athenaPracticeId,
      athenaPatientId,
      accessToken,
    });

    const hieOptOut = await getHieOptOut({ cxId, patientId });

    const respPayload: PatientHieOptOutResponse = {
      id: patientId,
      hieOptOut: hieOptOut,
      message: `Patient has opted ${hieOptOut ? "out from" : "in to"} the networks`,
    };

    return res.status(httpStatus.OK).json(respPayload);
  })
);

export default router;
