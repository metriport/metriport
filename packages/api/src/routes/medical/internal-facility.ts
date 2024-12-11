import { processAsyncError } from "@metriport/core/util/error/shared";
import { metriportCompanyDetails } from "@metriport/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { createFacility } from "../../command/medical/facility/create-facility";
import { getFacilityOrFail } from "../../command/medical/facility/get-facility";
import { updateFacility } from "../../command/medical/facility/update-facility";
import { verifyCxItVendorAccess } from "../../command/medical/facility/verify-access";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { Facility, FacilityCreate, isOboFacility } from "../../domain/medical/facility";
import {
  createOrUpdateCqOrganization,
  metriportIntermediaryOid,
  metriportOid,
} from "../../external/carequality/command/cq-organization/create-or-update-cq-organization";
import { metriportEmail as metriportEmailForCq } from "../../external/carequality/constants";
import { buildCqOrgNameForFacility, getCqAddress } from "../../external/carequality/shared";
import { requestLogger } from "../helpers/request-logger";
import { getUUIDFrom } from "../schemas/uuid";
import { asyncHandler, getFromQueryAsBoolean } from "../util";
import { internalDtoFromModel } from "./dtos/facilityDTO";
import { facilityInternalDetailsSchema } from "./schemas/facility";
import { buildCwOrgNameForFacility } from "../../external/commonwell/shared";
import { createOrUpdateCwOrganization } from "../../external/commonwell/command/cw-organization/create-or-update-cw-organization";

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
    const skipHie = getFromQueryAsBoolean("skipHie", req);

    const facilityDetails = facilityInternalDetailsSchema.parse(req.body);
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
      cqApproved: facilityDetails.cqApproved,
      cwApproved: facilityDetails.cwApproved,
    };
    let facility: Facility;
    if (facilityDetails.id) {
      await getFacilityOrFail({ cxId, id: facilityDetails.id });
      facility = await updateFacility({ id: facilityDetails.id, ...facilityCreate });
    } else {
      facility = await createFacility(facilityCreate);
    }
    const org = await getOrganizationOrFail({ cxId });
    const syncInHie = await verifyCxItVendorAccess(cxId, false);
    // TODO Move to external/hie https://github.com/metriport/metriport-internal/issues/1940
    // CAREQUALITY
    if (syncInHie && facility.cqApproved && !skipHie) {
      const isObo = isOboFacility(facility.cqType);
      const orgName = buildCqOrgNameForFacility({
        vendorName: org.data.name,
        orgName: facility.data.name,
        oboOid: isObo ? facilityDetails.cqOboOid : undefined,
      });
      const parentOrgOid = isObo ? metriportIntermediaryOid : metriportOid;
      const { coordinates, addressLine } = await getCqAddress({
        cxId,
        address: facility.data.address,
      });
      createOrUpdateCqOrganization({
        name: orgName,
        addressLine1: addressLine,
        lat: coordinates.lat.toString(),
        lon: coordinates.lon.toString(),
        city: facility.data.address.city,
        state: facility.data.address.state,
        postalCode: facility.data.address.zip,
        oid: facility.oid,
        contactName: metriportCompanyDetails.name,
        phone: metriportCompanyDetails.phone,
        email: metriportEmailForCq,
        active: org.cqActive,
        role: "Connection" as const,
        parentOrgOid,
      }).catch(processAsyncError("cq.internal.facility"));
    }
    // COMMONWELL
    if (syncInHie && facility.cwApproved && !skipHie) {
      const isObo = isOboFacility(facility.cwType);
      const orgName = buildCwOrgNameForFacility({
        vendorName: org.data.name,
        orgName: facility.data.name,
        oboOid: isObo ? facilityDetails.cwOboOid : undefined,
      });
      createOrUpdateCwOrganization({
        cxId,
        orgDetails: {
          oid: facility.oid,
          name: orgName,
          data: {
            name: orgName,
            type: org.data.type,
            location: facility.data.address,
          },
          active: facility.cwActive,
          isObo,
        },
      }).catch(processAsyncError("cw.internal.facility"));
    }
    return res.status(httpStatus.OK).json(internalDtoFromModel(facility));
  })
);

export default router;
