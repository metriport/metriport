import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { createOrUpdateCWOrganization } from "../../external/commonwell/create-or-update-cw-organization";
import { cwOrgActiveSchema } from "../../external/commonwell/shared";
import { requestLogger } from "../helpers/request-logger";
import { asyncHandler, getFrom } from "../util";

const router = Router();

/**
 * POST /internal/commonwell/directory/organization
 *
 * Creates or updates the organization in the CommonWell.
 */
router.post(
  "/organization",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getFrom("query").orFail("cxId", req);
    const orgId = getFrom("query").orFail("orgId", req);
    const body = req.body;
    const orgActive = cwOrgActiveSchema.parse(body);
    const org = await getOrganizationOrFail({ cxId, id: orgId });
    await createOrUpdateCWOrganization({
      ...org,
      active: orgActive.active,
    });

    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
