import NotFoundError from "@metriport/core/util/error/not-found";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { createOrUpdateCWOrganization } from "../../external/commonwell/create-or-update-cw-organization";
import { get as getCWOgranization, parseCWEntry } from "../../external/commonwell/organization";
import { cwOrgActiveSchema } from "../../external/commonwell/shared";
import { requestLogger } from "../helpers/request-logger";
import { asyncHandler, getFrom } from "../util";

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
    const cxId = getFrom("query").orFail("cxId", req);
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
 * PUT /internal/commonwell/organization
 *
 * Creates or updates the organization in the CommonWell.
 */
router.put(
  "/organization",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getFrom("query").orFail("cxId", req);
    const orgId = getFrom("query").orFail("orgId", req);
    const body = req.body;
    const orgActive = cwOrgActiveSchema.parse(body);
    const org = await getOrganizationOrFail({ cxId, id: orgId });
    await createOrUpdateCWOrganization(cxId, {
      oid: org.oid,
      data: org.data,
      active: orgActive.active,
    });
    await org.update({
      cwActive: orgActive.active,
    });

    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
