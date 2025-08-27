import axios from "axios";
import { Address } from "../../domain/address";
import { MetriportError, normalizeState } from "@metriport/shared";
import {
  CensusGeocoderParams,
  censusGeocoderResponseSchema,
  CensusGeocoderResponse,
  AddressMatch,
} from "./types";
import { getStreetFromAddress } from "./utils";
import { CENSUS_GEOCODER_HEADERS, CENSUS_GEOCODER_ADDRESS_URL } from "./constants";

/**
 * Geocode an address using the US Census Geocoder, and returns an array of AddressMatch objects.
 * @param address - The address to geocode.
 * @param options.benchmark - The Master Address File (MAF) to use for the geocoding:
 *    "Public_AR_Current" (default), "Public_AR_ACS2024", or "Public_AR_Census2020".
 *    See https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html for more details.
 * @returns An array of AddressMatch objects.
 */
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
