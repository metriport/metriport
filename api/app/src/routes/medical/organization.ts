import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { createOrganization } from "../../command/medical/organization/create-organization";
import { getOrganization } from "../../command/medical/organization/get-organization";
import { updateOrganization } from "../../command/medical/organization/update-organization";
import cwCommands from "../../external/commonwell";
import { Organization, OrganizationData } from "../../models/medical/organization";
import { asyncHandler, getCxIdOrFail } from "../util";
import { organizationSchema } from "./schemas/organization";

const router = Router();

type OrganizationDTO = Pick<Organization, "id"> & OrganizationData;

// TODO split this in two, one to create "POST /" and another to update "POST /:id"
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
    const org = {
      ...reqOrgData,
      location: {
        ...reqOrgData.location,
        addressLine2: reqOrgData.location.addressLine2 ?? undefined,
      },
    };

    let localOrg: Organization;

    if (org.id) {
      const data = { ...org };
      delete data.id;
      localOrg = await updateOrganization({ id: org.id, cxId, data });
      await cwCommands.organization.update(localOrg);
    } else {
      localOrg = await createOrganization({ cxId, data: org });
      await cwCommands.organization.create(localOrg);
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
