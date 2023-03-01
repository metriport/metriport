import { Request, Response } from "express";
import Router from "express-promise-router";

import status from "http-status";
import { createOrganization } from "../../command/medical/organization/create-organization";
import { getOrganization } from "../../command/medical/organization/get-organization";
import { updateOrganization } from "../../command/medical/organization/update-organization";
import { createOrUpdateCWOrg } from "../../external/commonwell/organization";
import { Organization, OrganizationData } from "../../models/medical/organization";
import { asyncHandler, getCxIdOrFail } from "../util";
import { Organization as OrganizationSchema, organizationSchema } from "./schemas/organization";

const router = Router();

type OrganizationDTO = Pick<Organization, "id"> & OrganizationData;

/** ---------------------------------------------------------------------------
 * POST /organization
 *
 * Updates or creates the organization if it doesn't exist already.
 *
 * @return  {OrganizationDTO}  The organization.
 */
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);

    const reqOrgData = organizationSchema.parse(req.body);

    const localOrgPayload: OrganizationSchema = {
      id: reqOrgData.id,
      name: reqOrgData.name,
      type: reqOrgData.type,
      location: reqOrgData.location,
    };

    await createOrUpdateCWOrg(localOrgPayload);

    // update if this is an existing org
    let localOrg: Organization;

    if (reqOrgData.id) {
      const data = { ...reqOrgData };
      delete data.id;
      localOrg = await updateOrganization({ id: reqOrgData.id, cxId, data: localOrgPayload });
    } else {
      localOrg = await createOrganization({ cxId, data: localOrgPayload });
    }

    const responsePayload: OrganizationDTO = { id: localOrg.id, ...localOrg.data };
    return res.status(status.OK).json(responsePayload);
  })
);

/** ---------------------------------------------------------------------------
 * GET /organization
 *
 * Gets the org corresponding to the customer ID.
 *
 * @return  {LocalOrg}  The organization.
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
