import { isCommonwellV2EnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
import { isProvider, Organization, OrganizationCreate } from "@metriport/core/domain/organization";
import { Config } from "@metriport/core/util/config";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { createOrganization } from "../../../command/medical/organization/create-organization";
import { getOrganizationsOrFail } from "../../../command/medical/organization/get-organization";
import { updateOrganization } from "../../../command/medical/organization/update-organization";
import { createOrUpdateOrganization as cqCreateOrUpdateOrganization } from "../../../external/carequality/command/create-or-update-organization";
import { createOrUpdateCWOrganization } from "../../../external/commonwell-v1/command/create-or-update-cw-organization";
import { createOrUpdateCWOrganizationV2 } from "../../../external/commonwell-v2/command/organization/create-or-update-cw-organization";
import { requestLogger } from "../../helpers/request-logger";
import { internalDtoFromModel } from "../../medical/dtos/organizationDTO";
import { organizationInternalDetailsSchema } from "../../medical/schemas/organization";
import { getUUIDFrom, validateUUID } from "../../schemas/uuid";
import { asyncHandler, getFromQueryAsArrayOrFail, getFromQueryAsBoolean } from "../../util";

const router = Router();

/** ---------------------------------------------------------------------------
 * PUT /internal/organization
 *
 * Creates or updates a organization and registers it within HIEs if new.
 *
 * @param cxId - The ID of the customer.
 * @param skipProviderCheck - Whether to skip the provider check. If true, the organization will be registered within HIEs even if it is not a provider.
 * @param body - The organization details.
 *
 * @return The updated organization.
 */
router.put(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    if (Config.isSandbox()) return res.sendStatus(httpStatus.NOT_IMPLEMENTED);
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const skipProviderCheck = getFromQueryAsBoolean("skipProviderCheck", req);

    const orgDetails = organizationInternalDetailsSchema.parse(req.body);
    const organizationCreate: OrganizationCreate = {
      cxId,
      type: orgDetails.businessType,
      data: {
        shortcode: orgDetails.shortcode,
        name: "name" in orgDetails ? orgDetails.name : orgDetails.nameInMetriport,
        type: orgDetails.type,
        location: orgDetails.location,
      },
      cqActive: orgDetails.cqActive,
      cwActive: orgDetails.cwActive,
      cqApproved: orgDetails.cqApproved,
      cwApproved: orgDetails.cwApproved,
    };
    const org: Organization = orgDetails.id
      ? await updateOrganization({ id: orgDetails.id, ...organizationCreate })
      : await createOrganization(organizationCreate);

    const syncInHie = skipProviderCheck || isProvider(org);
    // TODO Move to external/hie https://github.com/metriport/metriport-internal/issues/1940
    // CAREQUALITY
    if (syncInHie && org.cqApproved) {
      cqCreateOrUpdateOrganization({ org }).catch(processAsyncError("cq.internal.organization"));
    }
    // COMMONWELL
    if (syncInHie && org.cwApproved) {
      // TODO ENG-554 Remove FF and v1 code
      if (await isCommonwellV2EnabledForCx(cxId)) {
        createOrUpdateCWOrganizationV2({
          cxId,
          org: {
            oid: org.oid,
            data: org.data,
            active: org.cwActive,
            isInitiatorAndResponder: true,
          },
        }).catch(processAsyncError("cwV2.internal.organization"));
      } else {
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
    }
    return res.status(httpStatus.OK).json(internalDtoFromModel(org));
  })
);

/** ---------------------------------------------------------------------------
 * GET /internal/organization/
 *
 * Returns an organization from the db.
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxIds = getFromQueryAsArrayOrFail("cxIds", req).map<string>(id => validateUUID(id));

    const orgs = await getOrganizationsOrFail({ cxIds });

    return res.status(httpStatus.OK).json(orgs.map(internalDtoFromModel));
  })
);

export default router;
