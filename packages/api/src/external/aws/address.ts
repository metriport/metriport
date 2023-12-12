import { Address } from "../../domain/medical/address";
import {
  getCoordinatesFromLocation,
  makeLocationClient,
} from "@metriport/core/external/aws/location";
import { Config } from "../../shared/config";
import * as AWS from "aws-sdk";
import { Coordinates } from "@metriport/core/external/aws/location";

const indexName = Config.getPlaceIndexName();
const placeIndexRegion = Config.getPlaceIndexRegion();
const client = makeLocationClient(placeIndexRegion);

export function buildAddressText(address: Address): string {
  return `${address.addressLine1}, ${address.city}, ${address.state} ${address.zip}`;
}

/**
 * Adds coordinates to addresses that don't already have them
 *
 * @param addresses a list of Address objects
 * @returns a boolean indicating whether any addresses were updated
 */
export async function addGeographicCoordinates(addresses: Address[]): Promise<boolean> {
  const updates = await Promise.allSettled(
    addresses.map(async address => {
      if (address.coordinates) return false;
      address.coordinates = await geocodeAddress(address);
      return true;
    })
  );
  return updates.map(p => (p.status === "fulfilled" ? p.value : [])).includes(true);
}

/**
 * Geocodes an addresses using Amazon Location Services.
 * @param address an Address object
 * @returns a Coordinate pair
 */
export async function geocodeAddress(address: Address): Promise<Coordinates> {
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
  return getCoordinatesFromLocation({ result: locationResponse });
}
