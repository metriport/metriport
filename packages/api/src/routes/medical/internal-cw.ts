import NotFoundError from "@metriport/core/util/error/not-found";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import {
  verifyCxProviderAccess,
  verifyCxItVendorAccess,
} from "../../command/medical/facility/verify-access";
import {
  getOrganizationOrFail,
  getOrganizationByOidOrFail,
} from "../../command/medical/organization/get-organization";
import { getFaciltiyByOidOrFail } from "../../command/medical/facility/get-facility";
import { cwOrgActiveSchema } from "../../external/commonwell/shared";
import { getOrgOrFail } from "../../external/commonwell/command/cw-organization/get-cw-organization";
import { updateCWOrganizationAndMetriportEntity } from "../../external/commonwell/command/cw-organization/update-cw-organization-and-metriport-entity";
import { requestLogger } from "../helpers/request-logger";
import { asyncHandler, getFrom } from "../util";
import { getUUIDFrom } from "../schemas/uuid";
import { handleParams } from "../helpers/handle-params";

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
      await getFaciltiyByOidOrFail({ cxId, id: facilityId, oid });
    } else {
      await getOrganizationByOidOrFail({ cxId, oid });
    }
    const cwOrg = await getOrgOrFail(oid);
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
    await verifyCxProviderAccess(cxId);

    const org = await getOrganizationByOidOrFail({ cxId, oid });
    if (!org.cwApproved) throw new NotFoundError("CW not approved");

    const orgActive = cwOrgActiveSchema.parse(req.body);
    await updateCWOrganizationAndMetriportEntity({
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
    await verifyCxItVendorAccess(cxId);

    const org = await getOrganizationOrFail({ cxId });
    const facility = await getFaciltiyByOidOrFail({ cxId, id: facilityId, oid });
    if (!facility.cwApproved) throw new NotFoundError("CW not approved");

    const facilityActive = cwOrgActiveSchema.parse(req.body);
    await updateCWOrganizationAndMetriportEntity({
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
