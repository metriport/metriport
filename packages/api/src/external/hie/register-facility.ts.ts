import {
  AddressStrict,
  AddressWithCoordinates,
  removeCoordinates,
} from "@metriport/core/domain/location-address";
import {
  FacilityRegister,
  Facility,
  FacilityCreate,
  isOboFacility,
} from "../../domain/medical/facility";
import { buildCqOrgName } from "../../external/carequality/shared";
import { buildCwOrgName } from "../../external/commonwell/shared";
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
  const isObo = isOboFacility(facility.type);

  const [cxOrg, address, cqOboData] = await Promise.all([
    getCxOrganizationNameOidAndType(cxId),
    getAddressWithCoordinates(getAddressFromInput(facility), cxId),
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
    await createOrUpdateInCw(cmdFacility, cwOrgName, cxOrg.type, cxId, isObo);
  }

  return cmdFacility;
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
