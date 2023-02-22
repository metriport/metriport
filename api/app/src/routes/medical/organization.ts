import { Request, Response } from "express";
import Router from "express-promise-router";
import { asyncHandler, getCxIdOrFail } from "../util";
const router = Router();
import status from "http-status";
import { updateOrganization } from "../../command/medical/organization/update-organization";
import { createOrganization } from "../../command/medical/organization/create-organization";
import { getOrganization } from "../../command/medical/organization/get-organization";
import { Organization } from "../../models/medical/organization";

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

    // TODO: parse this into model
    const orgData = req.body;

    // update if this is an existing org
    let org: Organization;
    if (orgData.id) {
      const data = { ...orgData };
      delete data.id;
      org = await updateOrganization({ id: orgData.id, cxId, data });
    } else {
      org = await createOrganization({ cxId, data: orgData });
    }

    // TODO: create or update organization in CW as well

    return res.status(status.OK).json({ id: org.id, ...org.data });
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
