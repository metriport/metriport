import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import {
  OrganizationCreateCmd,
  createOrganization,
} from "../../command/medical/organization/create-organization";
import { getOrganization } from "../../command/medical/organization/get-organization";
import {
  OrganizationUpdateCmd,
  updateOrganization,
} from "../../command/medical/organization/update-organization";
import { processAsyncError } from "../../errors";
import cwCommands from "../../external/commonwell";
import { toFHIR } from "../../external/fhir/organization";
import { upsertOrgToFHIRServer } from "../../external/fhir/organization/upsert-organization";
import { getETag } from "../../shared/http";
import { asyncHandler, getCxIdOrFail, getFromParamsOrFail } from "../util";
import { dtoFromModel } from "./dtos/organizationDTO";
import { organizationCreateSchema, organizationUpdateSchema } from "./schemas/organization";
import { requestLogger } from "../helpers/request-logger";

const router = Router();

/** ---------------------------------------------------------------------------
 * POST /organization
 *
 * Creates a new organization at Metriport and HIEs.
 *
 * @param req.body The data to create the organization.
 * @returns The newly created organization.
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);

    const data = organizationCreateSchema.parse(req.body);

    const createOrg: OrganizationCreateCmd = { cxId, ...data };
    const org = await createOrganization(createOrg);

    // temp solution until we migrate to FHIR
    const fhirOrg = toFHIR(org);
    await upsertOrgToFHIRServer(org.cxId, fhirOrg);

    // TODO: #393 declarative, event-based integration
    // Intentionally asynchronous
    cwCommands.organization.create(org).catch(processAsyncError(`cw.org.create`));

    return res.status(status.CREATED).json(dtoFromModel(org));
  })
);

/** ---------------------------------------------------------------------------
 * PUT /organization/:id
 *
 * Updates the organization at Metriport and HIEs.
 *
 * @param req.body The data to update the organization.
 * @returns The updated organization.
 */
router.put(
  "/:id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const id = getFromParamsOrFail("id", req);
    const payload = organizationUpdateSchema.parse(req.body);

    const updateCmd: OrganizationUpdateCmd = {
      ...payload,
      ...getETag(req),
      id,
      cxId,
    };
    const org = await updateOrganization(updateCmd);

    // temp solution until we migrate to FHIR
    const fhirOrg = toFHIR(org);
    await upsertOrgToFHIRServer(org.cxId, fhirOrg);

    // TODO: #393 declarative, event-based integration
    // Intentionally asynchronous
    cwCommands.organization.update(org).catch(processAsyncError(`cw.org.update`));

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
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);

    const org = await getOrganization({ cxId });
    return res.status(status.OK).json(org ? dtoFromModel(org) : undefined);
  })
);

export default router;
