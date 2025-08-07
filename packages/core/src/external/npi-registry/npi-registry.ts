import {
  MetriportError,
  normalizeCity,
  toTitleCase,
  USState,
  validateNPI,
} from "@metriport/shared";
import axios from "axios";
import { Config } from "../../util/config";
import {
  FacilityType,
  NpiRegistryFacility,
  NpiRegistryReturn,
  FacilityInternalDetails,
  AdditionalInformationInternalFacility,
} from "../../domain/npi-facility";

const npiRegistryUrl = Config.getNpiRegistryUrlOrFail();
const npiRegistryVersion = Config.getNpiRegistryVersionOrFail();

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
    version: npiRegistryVersion,
    number: npi,
  });

  const res = await axios.get<NpiRegistryReturn>(npiRegistryUrl, {
    headers: { "Content-Type": "application/json" },
    params,
  });

  if (res.data.Errors && res.data.Errors.length > 0) {
    const err = res.data.Errors[0];
    if (err && err.description && err?.field && err.number) {
      throw new MetriportError(`NPI Registry error: ${err.description}`, undefined, {
        npi,
        npiRegistryUrl,
        npiRegistryVersion,
        description: err.description,
        field: err.field,
        errorNumber: err.number,
      });
    }
    //This should never happen but...
    throw new MetriportError(`NPI Registry error: Unexpected error`, undefined, {
      npi,
      npiRegistryUrl,
      npiRegistryVersion,
      description: "Unknown",
      field: "Unknown",
      errorNumber: "Unknown",
    });
  }

  const count = res.data.result_count
    ? parseInt(res.data.result_count, 10)
    : res.data.results?.length;
  if (!count || count < 1) {
    throw new MetriportError(
      `NPI Registry error. Found no Facilities with NPI: ${npi}`,
      undefined,
      { npi, npiRegistryUrl, npiRegistryVersion, count }
    );
  }

  if (!res.data.results || !res.data.results[0]) {
    throw new MetriportError(
      `NPI Registry error. Unexpected missing results for NPI: ${npi}`,
      undefined,
      { npi, npiRegistryUrl, npiRegistryVersion }
    );
  }

  const npiFacility = res.data.results[0];

  return npiFacility;
}

/**
 * Translates a NpiRegistryFacility to FacilityInternalDetails
 * @param npiFacility the NpiRegistryFacility you want to be translated
 * @param additionalInfo extra information such as the name, OBO, cqOboOid, cwOboOid
 * @returns the translated FacilityInternalDetails
 */
export function translateNpiFacilityToFacilityDetails(
  npiFacility: NpiRegistryFacility,
  additionalInfo: AdditionalInformationInternalFacility
): FacilityInternalDetails {
  const address = npiFacility.addresses[0];
  if (!address) {
    throw new MetriportError("No address in npi facility was found.", undefined, { address });
  }

  const isObo = additionalInfo.facilityType === "obo";

  let type: FacilityType = FacilityType.initiatorAndResponder;

  if (isObo) {
    type = FacilityType.initiatorOnly;
  }

  const internalFacility: FacilityInternalDetails = {
    city: normalizeCity(address.city),
    state: USState[address.state as keyof typeof USState],
    nameInMetriport: toTitleCase(additionalInfo.facilityName),
    npi: npiFacility.number,
    cqType: type,
    cwType: type,
    addressLine1: toTitleCase(address.address_1),
    zip: getZipFromPostalCode(address.postal_code),
    country: "USA",
  };

  if (isObo) {
    if (!additionalInfo.cqOboOid || !additionalInfo.cwOboOid) {
      throw new MetriportError(`If type is "obo" must provide cqOboOid and cwOboOid`, undefined, {
        isObo,
        cqOboOid: additionalInfo.cqOboOid,
        cwOboOid: !additionalInfo.cwOboOid,
      });
    }
    internalFacility.cqOboOid = additionalInfo.cqOboOid;
    internalFacility.cwOboOid = additionalInfo.cwOboOid;
  }
  return internalFacility;
}

export function getZipFromPostalCode(postalCode: string | undefined): string {
  if (!postalCode) throw new MetriportError(`No postal code given.`, undefined, { postalCode });

  return postalCode.slice(0, 5);
}
