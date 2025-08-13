import {
  MetriportError,
  normalizeCity,
  normalizeState,
  normalizeZipCodeNew,
  toTitleCase,
  validateNPI,
} from "@metriport/shared";
import axios from "axios";
import {
  AdditionalInformationInternalFacility,
  NpiRegistryFacility,
  NpiRegistryReturn,
} from "../../domain/npi-facility";

import { FacilityInternalDetails, FacilityType } from "../../domain/facility";

export const NPI_REGISTRY_URL = "https://npiregistry.cms.hhs.gov/api";
export const NPI_REGISTRY_VERSION = "2.1";

/**
 * Calls an external endpoint to retrieve facility information based off of the npi.
 * @param npi a npi of a facility. Must be exactly 10 digits long and valid under standard mod 10 Luhn algorithm.
 * @returns The NpiRegistryFacility.
 */
export async function getFacilityByNpiOrFail(npi: string): Promise<NpiRegistryFacility> {
  if (!validateNPI(npi)) {
    throw new MetriportError(
      `NPI is invalid. Make sure the npi is exactly 10 digits and is valid under standard mod 10 Luhn algorithm.`,
      undefined,
      { npi }
    );
  }
  const params = new URLSearchParams({
    version: NPI_REGISTRY_VERSION,
    number: npi,
  });

  const res = await axios.get<NpiRegistryReturn>(NPI_REGISTRY_URL, {
    headers: { "Content-Type": "application/json" },
    params,
  });

  if (res.data.Errors && res.data.Errors.length > 0) {
    type NpiRegistryError = { description?: string; field?: string; number?: string | number };
    const err: NpiRegistryError = res.data.Errors[0] ?? {};

    const description = err.description ?? "Unknown";
    const field = err.field ?? "Unknown";
    const errorNumber = err.number ?? "Unknown";

    throw new MetriportError(`NPI Registry error.`, undefined, {
      npi,
      NPI_REGISTRY_URL,
      NPI_REGISTRY_VERSION,
      description,
      field,
      errorNumber,
    });
  }

  const count = res.data.result_count
    ? parseInt(res.data.result_count, 10)
    : res.data.results?.length;
  if (!count || count < 1) {
    throw new MetriportError("NPI Registry error. No facilities found.", undefined, {
      npi,
      NPI_REGISTRY_URL,
      NPI_REGISTRY_VERSION,
      count,
    });
  } else if (!res.data.results || !res.data.results[0]) {
    throw new MetriportError("NPI Registry error. Missing results.", undefined, {
      npi,
      NPI_REGISTRY_URL,
      NPI_REGISTRY_VERSION,
    });
  }

  const npiFacility = res.data.results[0];

  return npiFacility;
}

/**
 * Translates a NpiRegistryFacility to FacilityInternalDetails
 * @param npiFacility the NpiRegistryFacility you want to be translated
 * @param additionalInfo extra required information to translate the name, if it is OBO, and the cqOboOid + cwOboOid
 * @returns the translated FacilityInternalDetails
 */
export function translateNpiFacilityToMetriportFacility(
  npiFacility: NpiRegistryFacility,
  additionalInfo: AdditionalInformationInternalFacility
): FacilityInternalDetails {
  const address = npiFacility.addresses[0];
  if (!address) {
    throw new MetriportError("NPI Registry facility has no address.", undefined, {
      npiFacilityNumber: npiFacility?.number,
    });
  }
  const isObo = additionalInfo.facilityType === "obo";

  const type = isObo ? FacilityType.initiatorOnly : FacilityType.initiatorAndResponder;
  const zip = normalizeZipCodeNew(address.postal_code);

  const internalFacility: FacilityInternalDetails = {
    city: normalizeCity(address.city),
    state: normalizeState(address.state),
    nameInMetriport: toTitleCase(additionalInfo.facilityName),
    npi: npiFacility.number,
    cqType: type,
    cwType: type,
    addressLine1: toTitleCase(address.address_1),
    zip,
    country: "USA",
  };

  if (isObo) {
    if (!additionalInfo.cqOboOid || !additionalInfo.cwOboOid) {
      throw new MetriportError(`If type is "obo" must provide cqOboOid and cwOboOid`, undefined, {
        isObo,
        cqOboOid: additionalInfo.cqOboOid,
        cwOboOid: additionalInfo.cwOboOid,
      });
    }
    internalFacility.cqOboOid = additionalInfo.cqOboOid;
    internalFacility.cwOboOid = additionalInfo.cwOboOid;
  }
  return internalFacility;
}
