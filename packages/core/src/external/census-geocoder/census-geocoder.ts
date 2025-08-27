import axios from "axios";
import { Address } from "../../domain/address";
import { MetriportError, normalizeState } from "@metriport/shared";
import {
  CensusGeocoderParams,
  censusGeocoderResponseSchema,
  CensusGeocoderResponse,
  AddressMatch,
} from "./types";
import { CENSUS_GEOCODER_HEADERS, CENSUS_GEOCODER_ADDRESS_URL } from "./constants";

export async function geocodeAddress(
  address: Address,
  { benchmark = "Public_AR_Current" }: CensusGeocoderParams = {}
): Promise<AddressMatch[]> {
  const params = new URLSearchParams({
    street: getStreetFromAddress(address),
    city: address.city,
    state: normalizeState(address.state),
    zip: address.zip,
    benchmark,
    format: "json",
  });
  const response = await axios.get<CensusGeocoderResponse>(CENSUS_GEOCODER_ADDRESS_URL, {
    headers: CENSUS_GEOCODER_HEADERS,
    params,
  });
  try {
    const { result } = censusGeocoderResponseSchema.parse(response.data);
    return result.addressMatches;
  } catch (error) {
    throw new MetriportError("Invalid response from US Census Geocoder", error, {
      address: JSON.stringify(address),
      response: JSON.stringify(response.data),
    });
  }
}

function getStreetFromAddress(address: Address): string {
  if (address.addressLine2) {
    return `${address.addressLine1} ${address.addressLine2}`;
  }
  return address.addressLine1;
}
