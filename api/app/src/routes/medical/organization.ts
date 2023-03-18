import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import {
  createOrganization,
  OrganizationCreateCmd,
} from "../../command/medical/organization/create-organization";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import {
  OrganizationUpdateCmd,
  updateOrganization,
} from "../../command/medical/organization/update-organization";
import cwCommands from "../../external/commonwell";
import { asyncHandler, getCxIdOrFail, getFromParamsOrFail } from "../util";
import { dtoFromModel } from "./dtos/organizationDTO";
import { baseUpdateSchemaToCmd } from "./schemas/base-update";
import { organizationCreateSchema, organizationUpdateSchema } from "./schemas/organization";

const router = Router();

/** ---------------------------------------------------------------------------
 * POST /organization
 *
 * Creates a new organization at Metroport and HIEs.
 *
 * @param req.body The data to create the organization.
 * @returns The newly created organization.
 */
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const data = organizationCreateSchema.parse(req.body);

    const createOrg: OrganizationCreateCmd = { cxId, ...data };
    const org = await createOrganization(createOrg);

    // TODO declarative, event-based integration: https://github.com/metriport/metriport-internal/issues/393
    // Intentionally asynchronous
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
 * @returns The updated organization.
 */
router.put(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const id = getFromParamsOrFail("id", req);
    const payload = organizationUpdateSchema.parse(req.body);

    const updateCmd: OrganizationUpdateCmd = {
      ...baseUpdateSchemaToCmd(payload),
      ...payload,
      id,
      cxId,
    };
    const org = await updateOrganization(updateCmd);

    // TODO declarative, event-based integration: https://github.com/metriport/metriport-internal/issues/393
    // Intentionally asynchronous
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
 * @returns The organization.
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);

    const org = await getOrganizationOrFail({ cxId });

    return res.status(status.OK).json(dtoFromModel(org));
  })
);

export default router;
