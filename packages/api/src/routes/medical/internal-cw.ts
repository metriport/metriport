import NotFoundError from "@metriport/core/util/error/not-found";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import {
  verifyCxProviderAccess,
  verifyCxItVendorAccess,
} from "../../command/medical/facility/verify-access";
import { isOboFacility } from "../../domain/medical/facility";
import { OrganizationModel } from "../../models/medical/organization";
import { FacilityModel } from "../../models/medical/facility";
import {
  getOrganizationOrFail,
  getOrganizationByOidOrFail,
} from "../../command/medical/organization/get-organization";
import { getFaciltiyByOidOrFail } from "../../command/medical/facility/get-facility";
import { createOrUpdateCWOrganization } from "../../external/commonwell/command/create-or-update-cw-organization";
import {
  CWOrganization,
  get as getCWOrganization,
  parseCWEntry,
} from "../../external/commonwell/organization";
import { cwOrgActiveSchema } from "../../external/commonwell/shared";
import { requestLogger } from "../helpers/request-logger";
import { asyncHandler, getFrom } from "../util";
import { getUUIDFrom } from "../schemas/uuid";

const router = Router();

async function getParsedOrg(oid: string): Promise<CWOrganization> {
  const resp = await getCWOrganization(oid);
  if (!resp) throw new NotFoundError("Organization not found");
  return parseCWEntry(resp);
}

/**
 * GET /internal/commonwell/organization/:oid
 *
 * Retrieves the organization with the specified OID from CommonWell.
 * @param req.params.oid The OID of the organization to retrieve.
 * @returns Returns the organization with the specified OID.
 */
router.get(
  "/organization/:oid",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityId = getFrom("query").optional("facilityId", req);
    const oid = getFrom("params").orFail("oid", req);

    if (facilityId) {
      await getFaciltiyByOidOrFail({ cxId, id: facilityId, oid });
    } else {
      await getOrganizationByOidOrFail({ cxId, oid });
    }
    const cwOrg = await getParsedOrg(oid);
    return res.status(httpStatus.OK).json(cwOrg);
  })
);

async function getAndUpdateCWOrg({
  cxId,
  oid,
  active,
  org,
  facility,
}: {
  cxId: string;
  oid: string;
  active: boolean;
  org: OrganizationModel;
  facility?: FacilityModel;
}): Promise<void> {
  const cwOrg = await getParsedOrg(oid);
  await createOrUpdateCWOrganization({
    cxId,
    org: {
      oid,
      data: {
        name: cwOrg.data.name,
        type: org.data.type,
        location: facility ? facility.data.address : org.data.location,
      },
      active,
    },
    isObo: facility ? isOboFacility(facility.cwType) : false,
  });
  if (facility) {
    await facility.update({
      cwActive: active,
    });
  } else {
    await org.update({
      cwActive: active,
    });
  }
}

/**
 * PUT /internal/commonwell/organization/:oid
 *
 * Updates the organization in the CommonWell.
 */
router.put(
  "/organization/:oid",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const oid = getFrom("params").orFail("oid", req);
    await verifyCxProviderAccess(cxId);

    const org = await getOrganizationByOidOrFail({ cxId, oid });
    if (!org.cwApproved) throw new NotFoundError("CW not approved");

    const orgActive = cwOrgActiveSchema.parse(req.body);
    await getAndUpdateCWOrg({
      cxId,
      oid,
      active: orgActive.active,
      org,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * PUT /internal/commonwell/facility/:oid
 *
 * Updates the facility in the CommonWell.
 * @param req.params.oid The OID of the facility to update.
 */
router.put(
  "/facility/:oid",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityId = getFrom("query").orFail("facilityId", req);
    const oid = getFrom("params").orFail("oid", req);
    await verifyCxItVendorAccess(cxId);

    const org = await getOrganizationOrFail({ cxId });
    const facility = await getFaciltiyByOidOrFail({ cxId, id: facilityId, oid });
    if (!facility.cwApproved) throw new NotFoundError("CW not approved");

    const facilityActive = cwOrgActiveSchema.parse(req.body);
    await getAndUpdateCWOrg({
      cxId,
      oid,
      active: facilityActive.active,
      org,
      facility,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
