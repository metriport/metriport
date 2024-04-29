import BadRequestError from "@metriport/core/util/error/bad-request";
import NotFoundError from "@metriport/core/util/error/not-found";
import { metriportCompanyDetails } from "@metriport/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { z } from "zod";
import { createFacility } from "../../command/medical/facility/create-facility";
import { getFacilityStrictOrFail } from "../../command/medical/facility/get-facility";
import { updateFacility } from "../../command/medical/facility/update-facility";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { FacilityType } from "../../domain/medical/facility";
import {
  createOrUpdateCQOrganization,
  getCqOrganization,
} from "../../external/carequality/command/cq-directory/create-or-update-cq-organization";
import { metriportEmail as metriportEmailForCq } from "../../external/carequality/constants";
import cwCommands from "../../external/commonwell";
import { FacilityModel } from "../../models/medical/facility";
import { OrganizationModel } from "../../models/medical/organization";
import { requestLogger } from "../helpers/request-logger";
import { required } from "../schemas/shared";
import { getUUIDFrom } from "../schemas/uuid";
import { asyncHandler } from "../util";
import { AddressStrictSchema } from "./schemas/address";

const router = Router();

export const cqOboOrgDetailsSchema = z.object({});
export type CqOboOrgDetails = z.infer<typeof cqOboOrgDetailsSchema>;

const facilityOboDetailsSchemaBase = z
  .object({
    id: z.string().optional(),
    nameInMetriport: z.string(),
    npi: z.string(),
    lat: z.string(),
    lon: z.string(),
    // CQ
    cqActive: z.boolean().optional(),
    cqOboOid: z.string().optional(),
    // CW
    cwActive: z.boolean().optional(),
    cwOboOid: z.string().optional(),
    cwFacilityName: z.string().optional(),
  })
  .merge(AddressStrictSchema);
type FacilityOboDetails = z.infer<typeof facilityOboDetailsSchemaBase>;

const facilityOboDetailsSchema = facilityOboDetailsSchemaBase
  .refine(required<FacilityOboDetails>("cqOboOid").when("cqActive"), {
    message: "cqObOid is required and can't be empty when cqActive is true",
    path: ["cqObOid"],
  })
  .refine(required<FacilityOboDetails>("cwOboOid").when("cwActive"), {
    message: "cwOboOid is required and can't be empty when cwActive is true",
    path: ["cwOboOid"],
  });

type CqOboDetails =
  | {
      enabled: true;
      cqFacilityName: string;
      cqOboOid: string;
    }
  | {
      enabled: false;
    };

/** ---------------------------------------------------------------------------
 *
 * PUT /internal/facility/
 *
 * Creates a new facility and registers it with HIEs the facility is enabled at.
 *
 * WIP: This endpoint is a work in progress and is not yet fully implemented.
 *
 * @return {FacilityDTO} The updated facility.
 */
router.put(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityInput = facilityOboDetailsSchema.parse(req.body);
    const id = facilityInput.id;
    const facilityDetails = {
      cxId,
      data: {
        name: facilityInput.nameInMetriport,
        npi: facilityInput.npi,
        address: {
          addressLine1: facilityInput.addressLine1,
          addressLine2: facilityInput.addressLine2,
          city: facilityInput.city,
          state: facilityInput.state,
          zip: facilityInput.zip,
          country: facilityInput.country,
        },
      },
      cqOboActive: facilityInput.cqActive,
      cqOboOid: facilityInput.cqOboOid,
      cwOboActive: facilityInput.cwActive,
      cwOboOid: facilityInput.cwOboOid,
      type: FacilityType.initiatorOnly,
    };

    // We keep this here to avoid creating a facility if the organization does not exist in CQ (for orgs that are CQ active)
    const cqOboData = await getCqOboData(facilityInput.cqActive, facilityInput.cqOboOid);

    let facility;
    if (id) {
      await getFacilityStrictOrFail({ cxId, id, npi: facilityInput.npi });
      facility = await updateFacility({
        id,
        ...facilityDetails,
      });
    } else {
      facility = await createFacility(facilityDetails);
    }

    const cxOrg = await getOrganizationOrFail({ cxId });
    const vendorName = cxOrg.dataValues.data?.name;
    // CAREQUALITY
    await createOrUpdateInCq(facilityInput, facility, cxOrg, vendorName, cqOboData);

    // COMMONWELL
    await createInCw(facilityInput, facility, cxOrg, cxId, vendorName);

    return res.sendStatus(httpStatus.OK);
  })
);

async function getCqOboData(
  cqActive: boolean | undefined,
  cqOboOid: string | undefined
): Promise<CqOboDetails> {
  if (cqActive && cqOboOid) {
    const cqFacilityName = await getCqFacilityName(cqOboOid);
    return {
      enabled: true,
      cqFacilityName,
      cqOboOid,
    };
  }
  return { enabled: false };
}

async function getCqFacilityName(oid: string) {
  const existingFacility = await getCqOrganization(oid);
  if (!existingFacility) {
    throw new BadRequestError("CQ OBO organization with the specified CQ OBO OID was not found");
  }
  const existingFacilityName = existingFacility.name?.value;
  if (!existingFacilityName) throw new NotFoundError("CQ OBO organization has no name");
  return existingFacilityName;
}

function buildCwOboOrgName(vendorName: string, orgName: string, oboOid: string) {
  return `${vendorName} - ${orgName} -OBO- ${oboOid}`;
}
function buildCqOboOrgName(vendorName: string, orgName: string, oboOid: string) {
  return `${vendorName} - ${orgName} #OBO# ${oboOid}`;
}

async function createOrUpdateInCq(
  facilityInput: FacilityOboDetails,
  facility: FacilityModel,
  cxOrg: OrganizationModel,
  vendorName: string,
  cqOboData: CqOboDetails
) {
  if (cqOboData.enabled) {
    const orgName = buildCqOboOrgName(vendorName, cqOboData.cqFacilityName, cqOboData.cqOboOid);
    const addressLine = facilityInput.addressLine2
      ? `${facilityInput.addressLine1}, ${facilityInput.addressLine2}`
      : facilityInput.addressLine1;

    console.log("Creating/Updating a CQ entry with this OID:", facility.oid);
    await createOrUpdateCQOrganization({
      name: orgName,
      addressLine1: addressLine,
      lat: facilityInput.lat,
      lon: facilityInput.lon,
      city: facilityInput.city,
      state: facilityInput.state,
      postalCode: facilityInput.zip,
      oid: facility.oid,
      contactName: metriportCompanyDetails.name,
      phone: metriportCompanyDetails.phone,
      email: metriportEmailForCq,
      parentOrgOid: cxOrg.oid,
      role: "Connection" as const,
    });
  }
}

async function createInCw(
  facilityInput: FacilityOboDetails,
  facility: FacilityModel,
  cxOrg: OrganizationModel,
  cxId: string,
  vendorName: string
) {
  if (facilityInput.cwActive && facilityInput.cwOboOid) {
    const cwFacilityName = facilityInput.cwFacilityName ?? facility.data.name;
    // TODO 1706: lookup CW org name from specified OID in DB
    const cwOboOrgName = buildCwOboOrgName(vendorName, cwFacilityName, facilityInput.cwOboOid);
    await cwCommands.organization.create(
      {
        cxId,
        id: facility.id,
        oid: facility.oid,
        data: {
          name: cwOboOrgName,
          type: cxOrg.data.type,
          location: facility.data.address,
        },
        organizationNumber: facility.facilityNumber,
        eTag: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      true
    );
  }
}

export default router;
