import { AddressStrict } from "@metriport/core/domain/location-address";
import BadRequestError from "@metriport/core/util/error/bad-request";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
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
import { addCoordinatesToAddresses } from "../../command/medical/patient/add-coordinates";
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

const facilityOboDetailsSchemaBase = z
  .object({
    id: z.string().optional(),
    nameInMetriport: z.string(),
    npi: z.string(),
    type: z.nativeEnum(FacilityType),
    // CQ
    cqOboActive: z.boolean().optional(),
    cqOboOid: z.string().optional(),
    // CW
    cwOboActive: z.boolean().optional(),
    cwOboOid: z.string().optional(),
    cwFacilityName: z.string().optional(),
  })
  .merge(AddressStrictSchema);
type FacilityOboDetails = z.infer<typeof facilityOboDetailsSchemaBase>;

const facilityOboDetailsSchema = facilityOboDetailsSchemaBase
  .refine(required<FacilityOboDetails>("cqOboOid").when("cqOboActive"), {
    message: "cqObOid is required and can't be empty when cqOboActive is true",
    path: ["cqObOid"],
  })
  .refine(required<FacilityOboDetails>("cwOboOid").when("cwOboActive"), {
    message: "cwOboOid is required and can't be empty when cwOboActive is true",
    path: ["cwOboOid"],
  });

type AddressWithCoordinates = AddressStrict & { lat: string; lon: string };

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
 * Creates a new facility and registers it with HIEs.
 *
 * TODO: Move code to each respective HIE's command/folder.
 * TODO: Add unit tests.
 * TODO: Search existing facility by NPI, cqOboOid, and cwOboOid (individually), and fail if it exists?
 *
 * @return The updated facility.
 */
router.put(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityInput = facilityOboDetailsSchema.parse(req.body);

    const [address, cqOboData, cxOrg] = await Promise.all([
      getAddress(getAddressFromInput(facilityInput), cxId),
      // We keep this here to avoid creating a facility if the organization does not exist in CQ (for orgs that are CQ active)
      getCqOboData(facilityInput.cqOboActive, facilityInput.cqOboOid),
      getOrganizationOrFail({ cxId }),
    ]);
    const vendorName = cxOrg.dataValues.data?.name;
    if (!vendorName) throw new Error("Organization name is missing");
    const addressStrict = removeCoordinates(address);

    // const facility = await createFacility({
    const id = facilityInput.id;
    const facilityDetails = {
      cxId,
      data: {
        name: facilityInput.nameInMetriport,
        npi: facilityInput.npi,
        address: addressStrict,
      },
      type: facilityInput.type,
      cqOboActive: facilityInput.cqOboActive,
      cqOboOid: facilityInput.cqOboOid,
      cwOboActive: facilityInput.cwOboActive,
      cwOboOid: facilityInput.cwOboOid,
    };

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

    // CAREQUALITY
    await createOrUpdateInCq(facilityInput, facility, cxOrg, vendorName, cqOboData, address);

    // COMMONWELL
    await createInCw(facilityInput, facility, cxOrg, cxId, vendorName);

    return res.status(httpStatus.OK).json(facility.dataValues);
  })
);

function getAddressFromInput(input: FacilityOboDetails): AddressStrict {
  return {
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2,
    city: input.city,
    state: input.state,
    zip: input.zip,
    country: input.country,
  };
}

function removeCoordinates(address: AddressWithCoordinates): AddressStrict {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { lat, lon, ...rest } = address;
  return rest;
}

async function getAddress(
  inputAddress: AddressStrict,
  cxId: string
): Promise<AddressWithCoordinates> {
  const addresses = await addCoordinatesToAddresses({
    addresses: [inputAddress],
    cxId,
  });
  const address = (addresses ?? [])[0];
  if (!address) throw new Error("Failed to geocode the address");
  if (!address.coordinates) {
    throw new MetriportError(`Missing coordinates for address`, undefined, {
      address: JSON.stringify(address),
    });
  }
  const { lat, lon } = address.coordinates;
  return {
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    state: address.state,
    zip: address.zip,
    country: address.country ?? "USA",
    lat: lat.toString(),
    lon: lon.toString(),
  };
}

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
  cqOboData: CqOboDetails,
  address: AddressWithCoordinates
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
      lat: address.lat,
      lon: address.lon,
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
  if (facilityInput.cwOboActive && facilityInput.cwOboOid) {
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
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      true
    );
  }
}

export default router;
