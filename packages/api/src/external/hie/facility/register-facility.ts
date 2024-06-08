import {
  AddressStrict,
  AddressWithCoordinates,
  removeCoordinates,
} from "@metriport/core/domain/location-address";
import { Coordinates } from "@metriport/core/domain/address";
import { FacilityRegister, Facility, FacilityCreate } from "../../../domain/medical/facility";
import { getCxOrganizationNameOidAndType } from "../../../command/medical/organization/get-organization";
import { getAddressWithCoordinates } from "../../../domain/medical/address";
import { getCqOboData } from "../../carequality/get-obo-data";
import { createOrUpdateFacility } from "../../../command/medical/facility/create-or-update-facility";
import { createOrUpdateInCq, createOrUpdateInCw } from "../shared";

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
    getCqOboData(facility.cqOboOid),
  ]);

  const { facilityDetails, coordinates } = createFacilityDetails(cxId, facility, address);

  const cmdFacility = await createOrUpdateFacility(
    cxId,
    facility.id,
    facility.data.npi,
    facilityDetails
  );

  // CAREQUALITY
  createOrUpdateInCq(cmdFacility, cxOrg, cqOboData, coordinates);

  // COMMONWELL
  createOrUpdateInCw(cmdFacility, facility.cwFacilityName, cxOrg, cxId);

  return cmdFacility;
}

export function createFacilityDetails(
  cxId: string,
  facility: FacilityRegister,
  address: AddressWithCoordinates
): { facilityDetails: FacilityCreate; coordinates: Coordinates } {
  const { address: addressStrict, coordinates } = removeCoordinates(address);

  const facilityDetails: FacilityCreate = {
    cxId,
    data: {
      name: facility.data.name,
      npi: facility.data.npi,
      address: addressStrict,
    },
    cqType: facility.cqType,
    cwType: facility.cwType,
    cqActive: facility.cqActive,
    cwActive: facility.cwActive,
    cqOboOid: facility.cqOboOid,
    cwOboOid: facility.cwOboOid,
  };

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
