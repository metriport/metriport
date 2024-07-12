import NotFoundError from "@metriport/core/util/error/not-found";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import {
  verifyCxProviderAccess,
  verifyCxItVendorAccess,
} from "../../command/medical/facility/verify-access";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { getFacilityOrFail } from "../../command/medical/facility/get-facility";
import { createOrUpdateCWOrganization } from "../../external/commonwell/command/create-or-update-cw-organization";
import { get as getCWOgranization, parseCWEntry } from "../../external/commonwell/organization";
import { cwOrgActiveSchema } from "../../external/commonwell/shared";
import { requestLogger } from "../helpers/request-logger";
import { asyncHandler, getFrom } from "../util";
import { getUUIDFrom } from "../schemas/uuid";

const router = Router();

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
    const oid = getFrom("params").orFail("oid", req);

    const org = await getOrganizationOrFail({ cxId });
    if (org.oid !== oid) throw new NotFoundError("Organization not found");

    const resp = await getCWOgranization(oid);
    if (!resp) throw new NotFoundError("Organization not found");
    const cwOrg = parseCWEntry(resp);

    return res.status(httpStatus.OK).json(cwOrg);
  })
);

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
    await verifyCxProviderAccess(cxId);
    const oid = getFrom("params").orFail("oid", req);

    const org = await getOrganizationOrFail({ cxId });
    if (org.oid !== oid) throw new NotFoundError("Organization not found");

    const resp = await getCWOgranization(oid);
    if (!resp) throw new NotFoundError("Organization not found");
    const cwOrg = parseCWEntry(resp);

    const orgActive = cwOrgActiveSchema.parse(req.body);
    await createOrUpdateCWOrganization(cxId, {
      oid: org.oid,
      data: {
        name: cwOrg.data.name,
        type: org.data.type,
        location: org.data.location,
      },
      active: orgActive.active,
    });
    await org.update({
      cwActive: orgActive.active,
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
    await verifyCxItVendorAccess(cxId);
    const facilityId = getFrom("query").orFail("facilityId", req);
    const oid = getFrom("params").orFail("oid", req);

    const org = await getOrganizationOrFail({ cxId });
    const facility = await getFacilityOrFail({ cxId, id: facilityId });
    if (facility.oid !== oid) throw new NotFoundError("Facility not found");

    const resp = await getCWOgranization(oid);
    if (!resp) throw new NotFoundError("Facility not found");
    const cwOrg = parseCWEntry(resp);

    const facilityActive = cwOrgActiveSchema.parse(req.body);

    await createOrUpdateCWOrganization(cxId, {
      oid: facility.oid,
      data: {
        name: cwOrg.data.name,
        type: org.data.type,
        location: facility.data.address,
      },
      active: facilityActive.active,
    });
    await facility.update({
      cqActive: facilityActive.active,
    });

    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
