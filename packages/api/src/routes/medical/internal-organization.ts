import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { Organization, OrganizationCreate } from "@metriport/core/domain/organization";
import { metriportEmail as metriportEmailForCq } from "../../external/carequality/constants";
import { metriportCompanyDetails } from "@metriport/shared";
import { requestLogger } from "../helpers/request-logger";
import { verifyCxProviderAccess } from "../../command/medical/facility/verify-access";
import { createOrganization } from "../../command/medical/organization/create-organization";
import { updateOrganization } from "../../command/medical/organization/update-organization";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { organiationInternalDetailsSchema } from "./schemas/organization";
import { internalDtoFromModel } from "./dtos/organizationDTO";
import { getUUIDFrom } from "../schemas/uuid";
import { asyncHandler } from "../util";
import { createOrUpdateCQOrganization } from "../../external/carequality/command/cq-directory/create-or-update-cq-organization";
import { createOrUpdateCWOrganization } from "../../external/commonwell/command/create-or-update-cw-organization";
import { getCqAddress } from "../../external/carequality/shared";
import { processAsyncError } from "@metriport/core/util/error/shared";

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
    const cxId = getUUIDFrom("query", req, "cxId").orFail();

    const orgDetails = organiationInternalDetailsSchema.parse(req.body);
    const organizationCreate: OrganizationCreate = {
      cxId,
      type: orgDetails.bizType,
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
    let organization: Organization;
    if (orgDetails.id) {
      const id = orgDetails.id;
      organization = await updateOrganization({ id, ...organizationCreate });
    } else {
      organization = await createOrganization(organizationCreate);
    }
    await verifyCxProviderAccess(cxId);
    const org = await getOrganizationOrFail({ cxId });
    // TODO Move to external/hie https://github.com/metriport/metriport-internal/issues/1940
    // CAREQUALITY
    if (org.cqApproved) {
      const { coordinates, addressLine } = await getCqAddress({ cxId, address: org.data.location });
      createOrUpdateCQOrganization({
        name: org.data.name,
        addressLine1: addressLine,
        lat: coordinates.lat.toString(),
        lon: coordinates.lon.toString(),
        city: org.data.location.city,
        state: org.data.location.state,
        postalCode: org.data.location.zip,
        oid: org.oid,
        organizationBizType: org.type,
        contactName: metriportCompanyDetails.name,
        phone: metriportCompanyDetails.phone,
        email: metriportEmailForCq,
        active: org.cqActive,
        role: "Connection" as const,
      }).catch(processAsyncError("cq.internal.organization"));
    }
    // COMMONWELL
    if (org.cwApproved) {
      createOrUpdateCWOrganization(cxId, {
        oid: org.oid,
        data: org.data,
        active: org.cwActive,
      }).catch(processAsyncError("cw.internal.organization"));
    }
    return res.status(httpStatus.OK).json(internalDtoFromModel(organization));
  })
);

export default router;
