import { Address } from "@metriport/api-sdk";
import {
  getCoordinatesFromLocation,
  makeLocationClient,
} from "@metriport/core/external/aws/location";
import { Config } from "../../shared/config";

export type Coordinates = {
  lat: number;
  lon: number;
};

type AddressWithoutCountry = Omit<Address, "country"> & { country?: string | undefined };

/**
 * Geocodes a list of addresses using Amazon Location Services.
 * @param addresses
 * @returns
 */
export async function getCoordinates(addresses: AddressWithoutCountry[]): Promise<Coordinates[]> {
  const indexName = Config.getPlaceIndexName();
  const awsRegion = Config.getAWSRegion();
  const client = makeLocationClient(awsRegion);

  const coords = [];

  for (const address of addresses) {
    const addressText =
      address.addressLine1 + ", " + address.city + ", " + address.state + " " + address.zip;

    const params = {
      Text: addressText,
      MaxResults: 1,
      Language: "en",
      FilterCountries: ["USA"],
      IndexName: indexName,
    };

    const locationResponse = await client.searchPlaceIndexForText(params).promise();
    const coordinates = getCoordinatesFromLocation({ result: locationResponse });

    coords.push(coordinates);
  }
  return coords;
}
