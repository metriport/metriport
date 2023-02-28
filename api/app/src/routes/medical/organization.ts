import { Request, Response } from "express";
import Router from "express-promise-router";

import { organizationSchema } from "./models/organization";
import { asyncHandler, getCxIdOrFail } from "../util";
const router = Router();
import status from "http-status";
import { updateOrganization } from "../../command/medical/organization/update-organization";
import { createOrganization } from "../../command/medical/organization/create-organization";
import { getOrganization } from "../../command/medical/organization/get-organization";
import { Organization } from "../../models/medical/organization";
import { createOrUpdateCWOrg } from "../../external/commonwell/organization";

/** ---------------------------------------------------------------------------
 * POST /organization
 *
 * Updates or creates the organization if it doesn't exist already.
 *
 * @return  {Organization}  The organization.
 */
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);

    const reqOrgData = organizationSchema.parse(req.body);

    const localOrgPayload = {
      name: reqOrgData.name,
      type: reqOrgData.type,
      locations: reqOrgData.locations,
    };

    await createOrUpdateCWOrg({
      name: reqOrgData.name,
      orgId: reqOrgData.id,
      localOrgPayload,
    });

    // update if this is an existing org
    let localOrg: Organization;

    if (reqOrgData.id) {
      const data = { ...reqOrgData };
      delete data.id;
      localOrg = await updateOrganization({ id: reqOrgData.id, cxId, data: localOrgPayload });
    } else {
      localOrg = await createOrganization({ cxId, data: localOrgPayload });
    }

    return res.status(status.OK).json({ id: localOrg.id, ...localOrg.data });
  })
);

/** ---------------------------------------------------------------------------
 * GET /organization
 *
 * Gets the org corresponding to the customer ID.
 *
 * @return  {Organization}  The organization.
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);

    const org = await getOrganization({ cxId });

    return res.status(status.OK).json(org ? { id: org.id, ...org.data } : undefined);
  })
);

export default router;
