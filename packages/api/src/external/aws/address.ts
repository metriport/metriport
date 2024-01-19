import { Address } from "@metriport/core/domain/address";
import {
  GeocodingResult,
  parseSuggestedAddress,
  getLocationResultPayload,
  makeLocationClient,
} from "@metriport/core/external/aws/location";
import * as AWS from "aws-sdk";
import { Config } from "../../shared/config";

export type AddressGeocodingResult = {
  address: Address;
  relevance: number;
  suggestedLabel: string;
};

const indexName = Config.getPlaceIndexName();
const placeIndexRegion = Config.getPlaceIndexRegion();
const client = makeLocationClient(placeIndexRegion);

export function buildAddressText(address: Address): string {
  return `${address.addressLine1}, ${address.city}, ${address.state} ${address.zip}`;
}

/**
 * Geocodes an addresses using Amazon Location Services.
 * @param address an Address object
 * @returns a Coordinate pair
 */
export async function geocodeAddress(address: Address): Promise<GeocodingResult | undefined> {
  const addressText = buildAddressText(address);
  const countryFilter = address.country ?? "USA";

  const params: AWS.Location.Types.SearchPlaceIndexForTextRequest = {
    Text: addressText,
    MaxResults: 1,
    Language: "en",
    FilterCountries: [countryFilter],
    IndexName: indexName,
  };

  const locationResponse = await client.searchPlaceIndexForText(params).promise();
  const resp = getLocationResultPayload({ result: locationResponse });

  const topSuggestion = resp ? resp[0] : undefined;
  if (topSuggestion) {
    return parseSuggestedAddress(topSuggestion);
  }
}
