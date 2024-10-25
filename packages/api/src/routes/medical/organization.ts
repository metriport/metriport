import { toFHIR } from "@metriport/core/external/fhir/organization/conversion";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { createOrganization } from "../../command/medical/organization/create-organization";
import { getOrganization } from "../../command/medical/organization/get-organization";
import { updateOrganization } from "../../command/medical/organization/update-organization";
import { getETag } from "../../shared/http";
import { getOutputFormatFromRequest } from "../helpers/output-format";
import { requestLogger } from "../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFromParamsOrFail, getFromQuery } from "../util";
import { dtoFromModel } from "./dtos/organizationDTO";
import {
  organizationBizTypeSchema,
  organizationCreateSchema,
  organizationUpdateSchema,
} from "./schemas/organization";

const router = Router();

/** ---------------------------------------------------------------------------
 * POST /organization
 *
 * @deprecated
 * Creates a new organization at Metriport and HIEs.
 *
 * @param req.body The data to create the organization.
 * @param req.params.organizationBizType Optional organization biz type.
 * @returns The newly created organization.
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const type = getFromQuery("organizationBizType", req);
    const organizationBizType = organizationBizTypeSchema.optional().parse(type);
    const data = organizationCreateSchema.parse(req.body);

    const org = await createOrganization({
      cxId,
      data,
      type: organizationBizType,
    });

    return res.status(status.CREATED).json(dtoFromModel(org));
  })
);

/** ---------------------------------------------------------------------------
 * PUT /organization/:id
 *
 * @deprecated
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
    const data = organizationUpdateSchema.parse(req.body);

    const org = await updateOrganization({
      data,
      ...getETag(req),
      id,
      cxId,
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
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const output = getOutputFormatFromRequest(req);

    const org = await getOrganization({ cxId });

    const respStatus = status.OK;
    if (!org) return res.status(respStatus).json(undefined);
    if (output === "fhir") return res.status(respStatus).json(toFHIR(org));
    return res.status(respStatus).json(dtoFromModel(org));
  })
);

export default router;
