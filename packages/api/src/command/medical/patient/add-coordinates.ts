import { Address, combineAddresses } from "@metriport/core/domain/address";
import { Patient } from "@metriport/core/domain/patient";
import { capture } from "@metriport/core/util/notifications";
import { Product } from "../../../domain/product";
import { AddressGeocodingResult, geocodeAddress } from "../../../external/aws/address";
import { EventTypes, analytics } from "../../../shared/analytics";
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
 * @param patient - the patient's id and cxId.
 * @param reportRelevance - optional, boolean to indicate whether to report a bad address to the cx. Defaults to false.
 * @returns - a list of Address objects with updated coordinates.
 */
export async function addCoordinatesToAddresses({
  addresses,
  patient,
  reportRelevance = false,
}: {
  addresses: Address[];
  patient: Pick<Patient, "id" | "cxId">;
  reportRelevance?: boolean;
}): Promise<Address[] | undefined> {
  if (Config.isSandbox()) return;
  const updatedAddresses = await addGeographicCoordinates(addresses, patient, reportRelevance);
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
export async function addGeographicCoordinates(
  addressList: Address[],
  patient: Pick<Patient, "id" | "cxId">,
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
          distinctId: patient.cxId,
          event: EventTypes.addressRelevance,
          properties: {
            relevance: result.relevance,
            aboveThreshold,
          },
          apiType: Product.medical,
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
    reportLowRelevance(belowThreshold, patient);
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
 * @param patient - the patient's id and cxId.
 */
export function reportLowRelevance(
  addresses: AddressGeocodingResult[],
  patient: Pick<Patient, "id" | "cxId">
): void {
  const msg = `Low address match coefficient`;

  console.log(`${msg}. Patient ID: ${patient.id}, Addresses: ${JSON.stringify(addresses)}`);
  capture.message(msg, {
    extra: {
      context: `getCoordinatesFromLocation`,
      addressesBelowThreshold: addresses,
      patient,
      threshold: ADDRESS_MATCH_RELEVANCE_THRESHOLD,
    },
    level: "warning",
  });
}
