import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { incrementOrganization } from "../../command/medical/__tests__/update-organization";
import { deleteOrgFromFHIRServer } from "../../external/fhir/__tests__/delete-organization";
import { deleteOrganization } from "../../command/medical/__tests__/delete-organization";
import { asyncHandler, getCxIdFromQueryOrFail, getFromParamsOrFail } from "../util";
import { dtoFromModel } from "./dtos/organizationDTO";

const router = Router();

/** ---------------------------------------------------------------------------
 * DELETE /internal/organization
 *
 * Deletes the org corresponding to the customer ID.
 * STRICTLY FOR TESTING ONLY - DO NOT USE IN PRODUCTION.
 *
 * @returns 200 OK.
 */
router.delete(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdFromQueryOrFail(req);
    const org = await getOrganizationOrFail({ cxId });

    await deleteOrgFromFHIRServer(cxId, org.id);
    await deleteOrganization({ cxId });

    return res.sendStatus(status.NO_CONTENT);
  })
);

/** ---------------------------------------------------------------------------
 * PUT /internal/organization/increment/:id
 *
 * Increments the org oid and number.
 * STRICTLY FOR TESTING ONLY - DO NOT USE IN PRODUCTION.
 *
 * @param req.id The data to update the organization.
 * @returns The updated organization.
 */
router.put(
  "/increment/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const id = getFromParamsOrFail("id", req);

    const org = await incrementOrganization(id);

    return res.status(status.OK).json(dtoFromModel(org));
  })
);
export default router;
