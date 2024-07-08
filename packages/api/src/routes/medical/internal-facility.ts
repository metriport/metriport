import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { requestLogger } from "../helpers/request-logger";
import BadRequestError from "@metriport/core/util/error/bad-request";
import { FacilityCreate } from "../../domain/medical/facility";
import { getFacilityByNpi } from "../../command/medical/facility/get-facility";
import { verifyCxItVendorAccess } from "../../command/medical/facility/verify-access";
import { createOrUpdateFacility } from "../../command/medical/facility/create-or-update-facility";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { facilityOboDetailsSchema } from "./schemas/facility";
import { internalDtoFromModel } from "./dtos/facilityDTO";
import { getUUIDFrom } from "../schemas/uuid";
import { asyncHandler } from "../util";
import { createOrUpdateFacilityInCq } from "../../external/carequality/command/cq-directory/create-or-update-cq-facility";
import { createOrUpdateInCw } from "../../external/commonwell/command/create-or-update-cw-facility";

const router = Router();

/** ---------------------------------------------------------------------------
 *
 * PUT /internal/facility
 *
 * Creates or updates a facility and registers it within HIEs if new.
 *
 * TODO: Search existing facility by NPI, cqOboOid, and cwOboOid (individually), and fail if it exists?
 *
 * @return The updated facility.
 */
router.put(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    await verifyCxItVendorAccess(cxId);

    const facilityDetails = facilityOboDetailsSchema.parse(req.body);
    const facilityCreate: FacilityCreate = {
      cxId,
      data: {
        name: facilityDetails.nameInMetriport,
        npi: facilityDetails.npi,
        address: {
          addressLine1: facilityDetails.addressLine1,
          addressLine2: facilityDetails.addressLine2,
          city: facilityDetails.city,
          state: facilityDetails.state,
          zip: facilityDetails.zip,
          country: facilityDetails.country,
        },
      },
      cqType: facilityDetails.cqType,
      cwType: facilityDetails.cwType,
      cqActive: facilityDetails.cqActive,
      cwActive: facilityDetails.cwActive,
      cqOboOid: facilityDetails.cqOboOid,
      cwOboOid: facilityDetails.cwOboOid,
    };
    const facilityByNpi = await getFacilityByNpi({ cxId, npi: facilityDetails.npi });
    if (!facilityDetails.id && facilityByNpi) {
      throw new BadRequestError(
        `Found a matching facility along NPI - please add the corresponding Facility ID to the request`
      );
    }

    const facility = await createOrUpdateFacility(
      cxId,
      facilityDetails.id,
      facilityDetails.npi,
      facilityCreate
    );
    const org = await getOrganizationOrFail({ cxId });
    // CAREQUALITY
    await createOrUpdateFacilityInCq({
      cxId,
      facility,
      facilityName: facilityDetails.cqFacilityName,
      cxOrgName: org.data.name,
      cxOrgBizType: org.type,
      cqOboOid: facilityDetails.cqOboOid,
    });
    // COMMONWELL
    await createOrUpdateInCw({
      cxId,
      facility,
      facilityName: facilityDetails.cwFacilityName,
      cxOrgName: org.data.name,
      cxOrgType: org.data.type,
      cwOboOid: facilityDetails.cwOboOid,
    });

    return res.status(httpStatus.OK).json(internalDtoFromModel(facility));
  })
);

export default router;
