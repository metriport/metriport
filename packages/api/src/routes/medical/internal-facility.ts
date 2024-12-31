import { isHealthcareItVendor } from "@metriport/core/domain/organization";
import { Config } from "@metriport/core/util/config";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { createFacility } from "../../command/medical/facility/create-facility";
import { getFacilityOrFail } from "../../command/medical/facility/get-facility";
import { updateFacility } from "../../command/medical/facility/update-facility";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { Facility, FacilityCreate } from "../../domain/medical/facility";
import { createOrUpdateFacility as cqCreateOrUpdateFacility } from "../../external/carequality/command/create-or-update-facility";
import { createOrUpdateFacilityInCw } from "../../external/commonwell/command/create-or-update-cw-facility";
import { requestLogger } from "../helpers/request-logger";
import { getUUIDFrom } from "../schemas/uuid";
import { asyncHandler } from "../util";
import { internalDtoFromModel } from "./dtos/facilityDTO";
import { facilityInternalDetailsSchema } from "./schemas/facility";

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
    if (Config.isSandbox()) return res.sendStatus(httpStatus.NOT_IMPLEMENTED);
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    // TODO Thomas, do we need this?
    // const skipHie = getFromQueryAsBoolean("skipHie", req);

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
    // TODO Thomas, do we need this?
    // const syncInHie = !skipHie && isHealthcareItVendor(org);
    const syncInHie = isHealthcareItVendor(org);
    // TODO Move to external/hie https://github.com/metriport/metriport-internal/issues/1940
    // CAREQUALITY
    if (syncInHie && facility.cqApproved) {
      cqCreateOrUpdateFacility({ org, facility }).catch(processAsyncError("cq.internal.facility"));
    }
    // COMMONWELL
    if (syncInHie && facility.cwApproved) {
      createOrUpdateFacilityInCw({
        cxId,
        facility,
        cxOrgName: org.data.name,
        cxOrgType: org.data.type,
        cwOboOid: facilityDetails.cwOboOid,
      }).catch(processAsyncError("cw.internal.facility"));
    }
    return res.status(httpStatus.OK).json(internalDtoFromModel(facility));
  })
);

export default router;
