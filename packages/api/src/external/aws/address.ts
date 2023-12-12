import {
  CoordinatesAndRelevance,
  getCoordinatesAndRelevanceFromLocation,
  getLocationResultPayload,
  makeLocationClient,
} from "@metriport/core/external/aws/location";
import * as AWS from "aws-sdk";
import { Address } from "../../domain/medical/address";
import { Config } from "../../shared/config";

export type AddressAndRelevance = {
  address: Address;
  relevance: number;
};

const indexName = Config.getPlaceIndexName();
const placeIndexRegion = Config.getPlaceIndexRegion();
const client = makeLocationClient(placeIndexRegion);

export function buildAddressText(address: Address): string {
  return `${address.addressLine1}, ${address.city}, ${address.state} ${address.zip}`;
}

/**
 * Adds coordinates to addresses that don't already have them.
 *
 * @param addressList a list of Address objects.
 * @returns a list of updated Address objects and their relevance score from geocoding.
 */
export async function addGeographicCoordinates(
  addressList: Address[]
): Promise<AddressAndRelevance[]> {
  const geocodingUpdates = await Promise.allSettled(
    addressList.map(async address => {
      if (address.coordinates) {
        return;
      }
      const coordinatesAndRelevance = await geocodeAddress(address);
      if (coordinatesAndRelevance) {
        address.coordinates = coordinatesAndRelevance.coordinates;
        const relevance = coordinatesAndRelevance.relevance;
        return {
          address,
          relevance,
        };
      }
      return;
    })
  );
  const updatedAddresses = geocodingUpdates.flatMap(p =>
    p.status === "fulfilled" && p.value ? p.value : []
  );
  return updatedAddresses;
}

/**
 * Geocodes an addresses using Amazon Location Services.
 * @param address an Address object
 * @returns a Coordinate pair
 */
export async function geocodeAddress(
  address: Address
): Promise<CoordinatesAndRelevance | undefined> {
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
    return getCoordinatesAndRelevanceFromLocation(topSuggestion);
  }
}
