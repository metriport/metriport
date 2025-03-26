import { isProvider, Organization, OrganizationCreate } from "@metriport/core/domain/organization";
import { Config } from "@metriport/core/util/config";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { createOrganization } from "../../../command/medical/organization/create-organization";
import { updateOrganization } from "../../../command/medical/organization/update-organization";
import { createOrUpdateOrganization as cqCreateOrUpdateOrganization } from "../../../external/carequality/command/create-or-update-organization";
import { createOrUpdateCWOrganization } from "../../../external/commonwell/command/create-or-update-cw-organization";
import { requestLogger } from "../../helpers/request-logger";
import { getUUIDFrom } from "../../schemas/uuid";
import { asyncHandler } from "../../util";
import { internalDtoFromModel } from "../../medical/dtos/organizationDTO";
import { organiationInternalDetailsSchema } from "../../medical/schemas/organization";

const router = Router();

/** ---------------------------------------------------------------------------
 *
 * PUT /internal/organization
 *
 * Creates or updates a organization and registers it within HIEs if new.
 *
 * @return The updated organization.
 */
router.put(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    if (Config.isSandbox()) return res.sendStatus(httpStatus.NOT_IMPLEMENTED);
    const cxId = getUUIDFrom("query", req, "cxId").orFail();

    const orgDetails = organiationInternalDetailsSchema.parse(req.body);
    const organizationCreate: OrganizationCreate = {
      cxId,
      type: orgDetails.businessType,
      data: {
        name: orgDetails.nameInMetriport,
        type: orgDetails.type,
        location: {
          addressLine1: orgDetails.addressLine1,
          addressLine2: orgDetails.addressLine2,
          city: orgDetails.city,
          state: orgDetails.state,
          zip: orgDetails.zip,
          country: orgDetails.country,
        },
      },
      cqActive: orgDetails.cqActive,
      cwActive: orgDetails.cwActive,
      cqApproved: orgDetails.cqApproved,
      cwApproved: orgDetails.cwApproved,
    };
    const org: Organization = orgDetails.id
      ? await updateOrganization({ id: orgDetails.id, ...organizationCreate })
      : await createOrganization(organizationCreate);

    const syncInHie = isProvider(org);
    // TODO Move to external/hie https://github.com/metriport/metriport-internal/issues/1940
    // CAREQUALITY
    if (syncInHie && org.cqApproved) {
      cqCreateOrUpdateOrganization({ org }).catch(processAsyncError("cq.internal.organization"));
    }
    // COMMONWELL
    if (syncInHie && org.cwApproved) {
      createOrUpdateCWOrganization({
        cxId,
        org: {
          oid: org.oid,
          data: org.data,
          active: org.cwActive,
        },
        isObo: false,
      }).catch(processAsyncError("cw.internal.organization"));
    }
    return res.status(httpStatus.OK).json(internalDtoFromModel(org));
  })
);

export default router;
