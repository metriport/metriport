import axios from "axios";
import { Address } from "../../domain/address";
import { normalizeState } from "@metriport/shared";
import {
  CensusGeocoderParams,
  censusGeocoderResponseSchema,
  CensusGeocoderResponse,
} from "./types";
import { CENSUS_GEOCODER_ADDRESS_URL } from "./constants";

export async function getNormalizedAddress(
  address: Address,
  { benchmark = "Public_AR_Current" }: CensusGeocoderParams = {}
) {
  const params = new URLSearchParams({
    street: getStreetFromAddress(address),
    city: address.city,
    state: normalizeState(address.state),
    zip: address.zip,
    benchmark,
    format: "json",
  });
  const response = await axios.get<CensusGeocoderResponse>(CENSUS_GEOCODER_ADDRESS_URL, {
    params,
  });
  const { result } = censusGeocoderResponseSchema.parse(response.data);
  const firstMatch = result.addressMatches[0];
  if (!firstMatch) {
    return address;
  }
  const components = firstMatch.addressComponents;
  return {
    addressLine1:
      `${components.preDirection} ${components.streetName} ${components.suffixDirection}`.trim(),
    addressLine2: `${components.fromAddress} - ${components.toAddress}`.trim(),
    city: components.city,
    state: components.state,
    zip: components.zip,
    coordinates: {
      lat: firstMatch.coordinates.y,
      lon: firstMatch.coordinates.x,
    },
  };
}

function getStreetFromAddress(address: Address): string {
  if (address.addressLine2) {
    return `${address.addressLine1} ${address.addressLine2}`;
  }
  return address.addressLine1;
}
