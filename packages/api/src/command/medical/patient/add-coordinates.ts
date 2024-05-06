import { Address, combineAddresses } from "@metriport/core/domain/address";
import { capture } from "@metriport/core/util/notifications";
import { AddressGeocodingResult, geocodeAddress } from "../../../external/aws/address";
import { analytics, EventTypes } from "../../../shared/analytics";
import { Config } from "../../../shared/config";

const ADDRESS_MATCH_RELEVANCE_THRESHOLD = 0.9;

type AddressBelowThreshold = {
  relevance: number;
  address: Address;
  suggestedLabel: string;
};

/**
 * Updates the addresses with geographic coordinates and optionally reports low relevance score addresses to the cx.
 *
 * @param addresses - a list of Address objects.
 * @param cxId - the customer's ID.
 * @param reportRelevance - optional, boolean to indicate whether to report a bad address to the cx. Defaults to false.
 * @returns - a list of Address objects with updated coordinates.
 */
export async function addCoordinatesToAddresses({
  addresses,
  cxId,
  reportRelevance = false,
}: {
  addresses: Address[];
  cxId: string;
  reportRelevance?: boolean;
}): Promise<Address[] | undefined> {
  if (Config.isSandbox()) return;
  const updatedAddresses = await addGeographicCoordinates(addresses, cxId, reportRelevance);
  const addressesWithCoordinates = combineAddresses(updatedAddresses, addresses);
  return addressesWithCoordinates;
}

/**
 * Generates geo coordinates for addresses that don't already have them. Reports relevance scores to the cx if requested.
 *
 * @param addressList a list of Address objects.
 * @param patient the patient's id and cxId.
 * @param reportRelevance optional, boolean to indicate whether to report a bad address to the cx. Defaults to false.
 * @returns a list of Address objects that got updated with coordinates.
 */
async function addGeographicCoordinates(
  addressList: Address[],
  cxId: string,
  reportRelevance = false
): Promise<Address[]> {
  const belowThreshold: AddressBelowThreshold[] = [];

  const results = await Promise.allSettled(
    addressList.map(async address => {
      if (address.coordinates) {
        return;
      }
      try {
        const suggested = await geocodeAddress(address);
        if (!suggested) return;

        const result = {
          address: {
            ...address,
            coordinates: suggested.coordinates,
          },
          relevance: suggested.relevance,
          suggestedLabel: suggested.suggestedLabel,
        };

        const aboveThreshold = result.relevance > ADDRESS_MATCH_RELEVANCE_THRESHOLD;

        analytics({
          distinctId: cxId,
          event: EventTypes.addressRelevance,
          properties: {
            relevance: result.relevance,
            aboveThreshold,
          },
        });

        if (!aboveThreshold) {
          belowThreshold.push(result);
        }

        return result.address;
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

  if (reportRelevance && belowThreshold.length) {
    reportLowRelevance(belowThreshold, cxId);
  }

  const updatedAddresses = results.flatMap(p => {
    return p.status === "fulfilled" && p.value ? p.value : [];
  });
  return updatedAddresses;
}

/**
 * Logs and reports low relevance scores to Sentry.
 * TODO: #1327 - automatically email the CX about a bad address
 *
 * @param addresses - a list of Address objects with low relevance scores.
 * @param cxId - the customer ID.
 */
export function reportLowRelevance(addresses: AddressGeocodingResult[], cxId: string): void {
  const msg = `Low address match coefficient`;
  console.log(`${msg}. Addresses: ${JSON.stringify(addresses)}`);
  capture.message(msg, {
    extra: {
      context: `getCoordinatesFromLocation`,
      addressesBelowThreshold: addresses,
      cxId,
      threshold: ADDRESS_MATCH_RELEVANCE_THRESHOLD,
    },
    level: "warning",
  });
}
