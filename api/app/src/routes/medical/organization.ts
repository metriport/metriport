import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { createOrganization } from "../../command/medical/organization/create-organization";
import { getOrganization } from "../../command/medical/organization/get-organization";
import { updateOrganization } from "../../command/medical/organization/update-organization";
import cwCommands from "../../external/commonwell";
import { asyncHandler, getCxIdOrFail, getFromParamsOrFail } from "../util";
import { dtoFromModel } from "./dtos/organizationDTO";
import { organizationSchema } from "./schemas/organization";

const router = Router();

/** ---------------------------------------------------------------------------
 * POST /organization
 *
 * Creates a new organization at Metroport and HIEs.
 *
 * @param req.body The data to create the organization.
 * @return The newly created organization.
 */
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const data = organizationSchema.parse(req.body);

    const org = await createOrganization({ cxId, data });

    // TODO declarative, event-based integration: https://github.com/metriport/metriport-internal/issues/393
    cwCommands.organization.create(org).then(undefined, (err: unknown) => {
      // TODO #156 Send this to Sentry
      console.error(`Failure while creating organization ${org.id} @ CW: `, err);
    });

    return res.status(status.CREATED).json(dtoFromModel(org));
  })
);

/** ---------------------------------------------------------------------------
 * PUT /organization/:id
 *
 * Updates the organization at Metriport and HIEs.
 *
 * @param req.body The data to udpate the organization.
 * @return The updated organization.
 */
router.put(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const orgId = getFromParamsOrFail("id", req);
    const data = organizationSchema.parse(req.body);

    const org = await updateOrganization({ id: orgId, cxId, data });

    // TODO declarative, event-based integration: https://github.com/metriport/metriport-internal/issues/393
    cwCommands.organization.update(org).then(undefined, (err: unknown) => {
      // TODO #156 Send this to Sentry
      console.error(`Failure while updating organization ${org.id} @ CW: `, err);
    });

    return res.status(status.OK).json(dtoFromModel(org));
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
