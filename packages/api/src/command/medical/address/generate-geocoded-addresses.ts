import { capture } from "@metriport/core/util/notifications";
import { Address } from "../../../domain/medical/address";
import { AddressGeocodingResult, geocodeAddress } from "../../../external/aws/address";

/**
 * Generates geo coordinates for addresses that don't already have them. Returns these addresses along with their relevance score from geocoding.
 *
 * @param addressList a list of Address objects.
 * @returns a list of Address objects that got updated with coordinates, relevance scores, and suggested labels.
 */
export async function addGeographicCoordinates(
  addressList: Address[]
): Promise<AddressGeocodingResult[]> {
  const geocodingUpdates = await Promise.allSettled(
    addressList.map(async address => {
      if (address.coordinates) {
        return;
      }
      try {
        const suggested = await geocodeAddress(address);
        if (!suggested) return;

        return {
          address: {
            ...address,
            coordinates: suggested.coordinates,
          },
          relevance: suggested.relevance,
          suggestedLabel: suggested.suggestedLabel,
        };
      } catch (error) {
        const msg = `Failed to geocode address`;
        console.log(`${msg}. Cause: ${error}`);
        capture.error(msg, {
          extra: { context: `addGeographicCoordinates`, error, address },
        });
        throw error;
      }
    })
  );

  const updatedAddresses = geocodingUpdates.flatMap(p => {
    if (p.status === "rejected") {
      return [];
    }
    return p.status === "fulfilled" && p.value ? p.value : [];
  });
  return updatedAddresses;
}
