import { AddressStrict } from "@metriport/core/domain/location-address";
import BadRequestError from "@metriport/core/util/error/bad-request";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import NotFoundError from "@metriport/core/util/error/not-found";
import { out } from "@metriport/core/util/log";
import { OrgType } from "@metriport/core/domain/organization";
import { metriportCompanyDetails } from "@metriport/shared";
import { addCoordinatesToAddresses } from "../../command/medical/patient/add-coordinates";
import {
  createOrUpdateCQOrganization,
  getCqOrganization,
} from "../../external/carequality/command/cq-directory/create-or-update-cq-organization";
import { metriportEmail as metriportEmailForCq } from "../../external/carequality/constants";
import cwCommands from "../../external/commonwell";
import { AddressWithCoordinates, CqOboDetails } from "../../domain/medical/facility";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { FacilityRegister, FacilityCreate, Facility } from "../../domain/medical/facility";
import { getFacilityStrictOrFail } from "../../command/medical/facility/get-facility";
import { createFacility } from "../../command/medical/facility/create-facility";
import { updateFacility } from "../../command/medical/facility/update-facility";

/**
 * Registers a new obo facility within HIEs.
 *
 * @param cxId
 * @param facility
 * @returns The updated facility.
 */
export async function registerFacilityWithinHIEs(
  cxId: string,
  facility: FacilityRegister
): Promise<Facility> {
  const isObo = facility.type === "initiator_only";

  const [cxOrg, address, cqOboData] = await Promise.all([
    getCxOrganizationNameAndOid(cxId),
    getAddress(getAddressFromInput(facility), cxId),
    getCqOboData(facility.cqOboActive, facility.cqOboOid),
  ]);

  const facilityDetails = createFacilityDetails(cxId, facility, address);

  let oboFacilityDetails = facilityDetails;

  if (isObo) {
    oboFacilityDetails = {
      ...oboFacilityDetails,
      cqOboActive: facility.cqOboActive,
      cqOboOid: facility.cqOboOid,
      cwOboActive: facility.cwOboActive,
      cwOboOid: facility.cwOboOid,
    };
  }

  const cmdFacility = await createOrUpdateFacility(
    cxId,
    facility.id,
    facility.data.npi,
    oboFacilityDetails
  );

  // CAREQUALITY
  const cqOboEnabled = isObo && cqOboData.enabled;
  if (cqOboEnabled || !isObo) {
    const cqFacilityName = cqOboEnabled ? cqOboData.cqFacilityName : cmdFacility.data.name;
    const cqOboOid = cqOboEnabled ? cqOboData.cqOboOid : undefined;
    const cqOrgName = buildCqOrgName(cxOrg.name, cqFacilityName, cqOboOid);
    await createOrUpdateInCq(cmdFacility, cxOrg.oid, cqOrgName, address);
  }

  // COMMONWELL
  const cwOboEnabled = isObo && facility.cwOboActive && facility.cwOboOid;
  if (cwOboEnabled || !isObo) {
    const cwFacilityName = facility.cwFacilityName ?? cmdFacility.data.name;
    const cwOrgName = buildCwOrgName(cxOrg.name, cwFacilityName, facility.cwOboOid);
    await createInCw(cmdFacility, cwOrgName, cxOrg.type, cxId);
  }

  return cmdFacility;
}

async function getCxOrganizationNameAndOid(
  cxId: string
): Promise<{ name: string; oid: string; type: OrgType }> {
  const cxOrg = await getOrganizationOrFail({ cxId });

  const vendorName = cxOrg.dataValues.data?.name;
  if (!vendorName) throw new Error("Organization name is missing");

  return { name: vendorName, oid: cxOrg.oid, type: cxOrg.data.type };
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

function getAddressFromInput(input: FacilityRegister): AddressStrict {
  const address = input.data.address;
  return {
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    state: address.state,
    zip: address.zip,
    country: address.country,
  };
}

async function getCqOboData(
  cqActive?: boolean | null,
  cqOboOid?: string | null
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

function createFacilityDetails(
  cxId: string,
  facility: FacilityRegister,
  address: AddressWithCoordinates
): FacilityCreate {
  const addressStrict = removeCoordinates(address);

  const facilityDetails = {
    cxId,
    data: {
      name: facility.data.name,
      npi: facility.data.npi,
      address: addressStrict,
    },
    type: facility.type,
  };

  return facilityDetails;
}

function removeCoordinates(address: AddressWithCoordinates): AddressStrict {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { lat, lon, ...rest } = address;
  return rest;
}

async function createOrUpdateFacility(
  cxId: string,
  facilityId: string | undefined,
  facilityNpi: string,
  facility: FacilityCreate
): Promise<Facility> {
  if (facilityId) {
    await getFacilityStrictOrFail({ cxId, id: facilityId, npi: facilityNpi });
    const updatedFacility = await updateFacility({
      id: facilityId,
      ...facility,
    });

    return updatedFacility;
  }

  const createdFacility = await createFacility(facility);

  return createdFacility;
}

function buildCqOrgName(vendorName: string, orgName: string, oboOid?: string): string {
  if (oboOid) {
    return `${vendorName} - ${orgName} #OBO# ${oboOid}`;
  }

  return `${vendorName} - ${orgName}`;
}

function buildCwOrgName(vendorName: string, orgName: string, oboOid?: string | null): string {
  if (oboOid) {
    return `${vendorName} - ${orgName} -OBO- ${oboOid}`;
  }
  return `${vendorName} - ${orgName}`;
}

async function createOrUpdateInCq(
  facility: Facility,
  cxOid: string,
  orgName: string,
  coordinates: AddressWithCoordinates
) {
  const { log } = out("createOrUpdateInCq");
  const { address } = facility.data;

  const addressLine = address.addressLine2
    ? `${address.addressLine1}, ${address.addressLine2}`
    : address.addressLine1;

  log(`Creating/Updating a CQ entry with this OID ${facility.oid} and name ${orgName}`);

  await createOrUpdateCQOrganization({
    name: orgName,
    addressLine1: addressLine,
    lat: coordinates.lat,
    lon: coordinates.lon,
    city: address.city,
    state: address.state,
    postalCode: address.zip,
    oid: facility.oid,
    contactName: metriportCompanyDetails.name,
    phone: metriportCompanyDetails.phone,
    email: metriportEmailForCq,
    parentOrgOid: cxOid,
    role: "Connection" as const,
  });
}

// WHY DO WE ONLY CREATE BUT WE CREATE OR UPDATE IN CQ?
async function createInCw(facility: Facility, orgName: string, cxOrgType: OrgType, cxId: string) {
  const { log } = out("createInCw");
  log(`Creating/Updating a CW entry with this OID ${facility.oid} and name ${orgName}`);
  await cwCommands.organization.create(
    {
      cxId,
      id: facility.id,
      oid: facility.oid,
      data: {
        name: orgName,
        type: cxOrgType,
        location: facility.data.address,
      },
      organizationNumber: facility.facilityNumber,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    true
  );
}
