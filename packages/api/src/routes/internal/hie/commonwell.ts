import { NotFoundError } from "@metriport/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { stringToBoolean } from "@metriport/shared";
import { getFacilityByOidOrFail } from "../../../command/medical/facility/get-facility";
import {
  verifyCxAccessToSendFacilityToHies,
  verifyCxAccessToSendOrgToHies,
} from "../../../command/medical/facility/verify-access";
import {
  getOrganizationByOidOrFail,
  getOrganizationOrFail,
} from "../../../command/medical/organization/get-organization";
import { getAndUpdateCWOrgAndMetriportOrg } from "../../../external/commonwell/command/create-or-update-cw-organization";
import { getParsedOrgOrFail } from "../../../external/commonwell/organization";
import { cwOrgActiveSchema } from "../../../external/commonwell/shared";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import { getUUIDFrom } from "../../schemas/uuid";
import { asyncHandler, getFrom } from "../../util";
import { runOrScheduleCwPatientDiscovery } from "../../../external/commonwell/command/run-or-schedule-patient-discovery";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";

const router = Router();

/**
 * GET /internal/commonwell/ops/organization/:oid
 *
 * Retrieves the organization with the specified OID from CommonWell.
 * @param req.params.oid The OID of the organization to retrieve.
 * @returns Returns the organization with the specified OID.
 */
router.get(
  "/ops/organization/:oid",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityId = getFrom("query").optional("facilityId", req);
    const oid = getFrom("params").orFail("oid", req);

    if (facilityId) {
      await getFacilityByOidOrFail({ cxId, id: facilityId, oid });
    } else {
      await getOrganizationByOidOrFail({ cxId, oid });
    }
    const cwOrg = await getParsedOrgOrFail(oid);
    return res.status(httpStatus.OK).json(cwOrg);
  })
);

/**
 * PUT /internal/commonwell/ops/organization/:oid
 *
 * Updates the organization in the CommonWell.
 */
router.put(
  "/ops/organization/:oid",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const oid = getFrom("params").orFail("oid", req);
    await verifyCxAccessToSendOrgToHies(cxId);

    const org = await getOrganizationByOidOrFail({ cxId, oid });
    if (!org.cwApproved) throw new NotFoundError("CW not approved");

    const orgActive = cwOrgActiveSchema.parse(req.body);
    await getAndUpdateCWOrgAndMetriportOrg({
      cxId,
      oid,
      active: orgActive.active,
      org,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * PUT /internal/commonwell/ops/facility/:oid
 *
 * Updates the facility in the CommonWell.
 * @param req.params.oid The OID of the facility to update.
 */
router.put(
  "/ops/facility/:oid",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityId = getFrom("query").orFail("facilityId", req);
    const oid = getFrom("params").orFail("oid", req);
    await verifyCxAccessToSendFacilityToHies(cxId);

    const org = await getOrganizationOrFail({ cxId });
    const facility = await getFacilityByOidOrFail({ cxId, id: facilityId, oid });
    if (!facility.cwApproved) throw new NotFoundError("CW not approved");

    const facilityActive = cwOrgActiveSchema.parse(req.body);
    await getAndUpdateCWOrgAndMetriportOrg({
      cxId,
      oid,
      active: facilityActive.active,
      org,
      facility,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/commonwell/patient-discovery/:patientId
 *
 * Triggers patient discovery for a specific patient in CommonWell.
 * @param req.query.cxId The customer ID.
 * @param req.params.patientId The ID of the patient to run discovery for
 * @param req.query.rerunPdOnNewDemographics Optional flag to rerun discovery if new demographics are found
 * @param req.query.forceCommonwell Optional flag to force CommonWell discovery
 * @returns 200 OK if discovery was triggered successfully
 */
router.post(
  "/patient-discovery/:patientId",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFrom("params").orFail("patientId", req);
    const rerunPdOnNewDemographics = stringToBoolean(
      getFrom("query").optional("rerunPdOnNewDemographics", req)
    );
    const forceCommonwell = stringToBoolean(getFrom("query").optional("forceCommonwell", req));

    const patient = await getPatientOrFail({ id: patientId, cxId });
    const facilityId = patient.facilityIds[0];
    const requestId = uuidv7();

    await runOrScheduleCwPatientDiscovery({
      patient,
      facilityId,
      requestId,
      getOrgIdExcludeList: () => Promise.resolve([]),
      rerunPdOnNewDemographics,
      forceCommonwell,
    });

    return res.status(httpStatus.OK).json({ requestId });
  })
);

export default router;
