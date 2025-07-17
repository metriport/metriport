import { isCommonwellV2EnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { NotFoundError } from "@metriport/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { getFacilityByOidOrFail } from "../../../command/medical/facility/get-facility";
import {
  verifyCxAccessToSendFacilityToHies,
  verifyCxAccessToSendOrgToHies,
} from "../../../command/medical/facility/verify-access";
import {
  getOrganizationByOidOrFail,
  getOrganizationOrFail,
} from "../../../command/medical/organization/get-organization";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { getAndUpdateCWOrgAndMetriportOrg } from "../../../external/commonwell-v1/command/create-or-update-cw-organization";
import { runOrScheduleCwPatientDiscovery } from "../../../external/commonwell-v1/command/run-or-schedule-patient-discovery";
import { getParsedOrgOrFail } from "../../../external/commonwell-v1/organization";
import { cwOrgActiveSchema } from "../../../external/commonwell-v1/shared";
import { getAndUpdateCWOrgAndMetriportOrgV2 } from "../../../external/commonwell-v2/command/organization/create-or-update-cw-organization";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import { getUUIDFrom } from "../../schemas/uuid";
import { asyncHandler, getFrom, getFromQueryAsBoolean } from "../../util";

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
    if (await isCommonwellV2EnabledForCx(cxId)) {
      await getAndUpdateCWOrgAndMetriportOrgV2({
        cxId,
        oid,
        active: orgActive.active,
        org,
      });
    } else {
      await getAndUpdateCWOrgAndMetriportOrg({
        cxId,
        oid,
        active: orgActive.active,
        org,
      });
    }
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
    // TODO this should be refactored: (1) the oid is already in the facility; (2) we should have a fn for org
    // and one for facility (the impl of getAndUpdateCWOrgAndMetriportOrg uses facility of org based on whether
    // facility is set or not); (3) we're loading models on the route and passing those around; (4) the route
    // has part of the logic to implement the endpoint (it should be in a command).
    const oid = getFrom("params").orFail("oid", req);

    await verifyCxAccessToSendFacilityToHies(cxId);

    const org = await getOrganizationOrFail({ cxId });
    const facility = await getFacilityByOidOrFail({ cxId, id: facilityId, oid });
    if (!facility.cwApproved) throw new NotFoundError("CW not approved");

    const facilityActive = cwOrgActiveSchema.parse(req.body);
    if (await isCommonwellV2EnabledForCx(cxId)) {
      await getAndUpdateCWOrgAndMetriportOrgV2({
        cxId,
        oid,
        active: facilityActive.active,
        org,
        facility,
      });
    } else {
      await getAndUpdateCWOrgAndMetriportOrg({
        cxId,
        oid,
        active: facilityActive.active,
        org,
        facility,
      });
    }
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
    const rerunPdOnNewDemographics = getFromQueryAsBoolean("rerunPdOnNewDemographics", req);
    const forceCommonwell = getFromQueryAsBoolean("forceCommonwell", req);

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
