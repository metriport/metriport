import { Address } from "@metriport/core/domain/address";
import {
  GeocodingResult,
  getLocationResultPayload,
  makeLocationClient,
  parseSuggestedAddress,
} from "@metriport/core/external/aws/location";
import * as AWS from "aws-sdk";
import { Config } from "../../shared/config";

export type AddressGeocodingResult = {
  address: Address;
  relevance: number;
  suggestedLabel: string;
};

let indexName: string | undefined;
let placeIndexRegion: string | undefined;
let client: AWS.Location | undefined;

function getIndexName(): string {
  if (!indexName) indexName = Config.getPlaceIndexName();
  return indexName;
}
function getPlaceIndexRegion(): string {
  if (!placeIndexRegion) placeIndexRegion = Config.getPlaceIndexRegion();
  return placeIndexRegion;
}
function getLocationClient(): AWS.Location {
  if (!client) {
    placeIndexRegion = getPlaceIndexRegion();
    client = makeLocationClient(placeIndexRegion);
  }
  return client;
}

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
    IndexName: getIndexName(),
  };

  const locationResponse = await getLocationClient().searchPlaceIndexForText(params).promise();
  const resp = getLocationResultPayload({ result: locationResponse });

  const topSuggestion = resp ? resp[0] : undefined;
  if (topSuggestion) {
    return parseSuggestedAddress(topSuggestion);
  }
}
