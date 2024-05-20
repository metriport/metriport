import {
  AddressStrict,
  AddressWithCoordinates,
  removeCoordinates,
} from "@metriport/core/domain/location-address";
import { Coordinates } from "@metriport/core/domain/address";
import {
  FacilityRegister,
  Facility,
  FacilityCreate,
  isOboFacility,
} from "../../domain/medical/facility";
import { getCxOrganizationNameOidAndType } from "../../command/medical/organization/get-organization";
import { getAddressWithCoordinates } from "../../domain/medical/address";
import { getCqOboData } from "../../external/carequality/get-obo-data";
import { createOrUpdateFacility } from "../../command/medical/facility/create-or-update-facility";
import { createOrUpdateInCq, createOrUpdateInCw } from "./shared";

/**
 * Registers a new facility within HIEs.
 *
 * @param cxId
 * @param facility
 * @returns The updated facility.
 */
export async function registerFacilityWithinHIEs(
  cxId: string,
  facility: FacilityRegister
): Promise<Facility> {
  const [cxOrg, address, cqOboData] = await Promise.all([
    getCxOrganizationNameOidAndType(cxId),
    getAddressWithCoordinates(getAddressFromInput(facility), cxId),
    getCqOboData(facility.cqOboActive, facility.cqOboOid),
  ]);

  const { facilityDetails, coordinates } = createFacilityDetails(cxId, facility, address);

  const cmdFacility = await createOrUpdateFacility(
    cxId,
    facility.id,
    facility.data.npi,
    facilityDetails
  );

  // CAREQUALITY
  await createOrUpdateInCq(cmdFacility, cxOrg, cqOboData, coordinates);

  // COMMONWELL
  await createOrUpdateInCw(cmdFacility, facility.cwFacilityName, cxOrg, cxId);

  return cmdFacility;
}

function createFacilityDetails(
  cxId: string,
  facility: FacilityRegister,
  address: AddressWithCoordinates
): { facilityDetails: FacilityCreate; coordinates: Coordinates } {
  const isCqObo = isOboFacility(facility.cqType);
  const isCwObo = isOboFacility(facility.cwType);
  const { address: addressStrict, coordinates } = removeCoordinates(address);

  let facilityDetails: FacilityCreate = {
    cxId,
    data: {
      name: facility.data.name,
      npi: facility.data.npi,
      address: addressStrict,
    },
    cqType: facility.cqType,
    cwType: facility.cwType,
  };

  if (isCqObo) {
    facilityDetails = {
      ...facilityDetails,
      cqOboActive: facility.cqOboActive,
      cqOboOid: facility.cqOboOid,
    };
  }

  if (isCwObo) {
    facilityDetails = {
      ...facilityDetails,
      cwOboActive: facility.cwOboActive,
      cwOboOid: facility.cwOboOid,
    };
  }

  return {
    facilityDetails,
    coordinates,
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
