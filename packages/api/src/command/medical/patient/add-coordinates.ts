import { Address, combineAddresses } from "../../../domain/medical/address";
import { Patient } from "../../../domain/medical/patient";
import { Product } from "../../../domain/product";
import { AddressGeocodingResult } from "../../../external/aws/address";
import { EventTypes, analytics } from "../../../shared/analytics";
import { capture } from "../../../shared/notifications";
import { addGeographicCoordinates } from "../address/generate-geocoded-addresses";

const ADDRESS_MATCH_RELEVANCE_THRESHOLD = 0.9;

/**
 * Updates the addresses with geographic coordinates and optionally reports low relevance score addresses to the cx.
 *
 * @param addresses - a list of Address objects.
 * @param reportRelevance - optional, boolean to indicate whether to report a bad address to the cx. Defaults to false.
 * @returns - a list of Address objects with updated coordinates.
 */
export async function addCoordinatesToAddresses({
  addresses,
  patient,
  reportRelevance = false,
}: {
  addresses: Address[];
  patient: Partial<Patient>;
  reportRelevance?: boolean;
}): Promise<Address[]> {
  const geocodedAddressResults = await addGeographicCoordinates(addresses);
  if (reportRelevance) reportLowRelevance(geocodedAddressResults, patient);

  const updatedAddresses = geocodedAddressResults.map(p => p.address);
  const addressesWithCoordinates = combineAddresses(updatedAddresses, addresses);
  return addressesWithCoordinates;
}

export function reportLowRelevance(
  addresses: AddressGeocodingResult[],
  patient: Partial<Patient>
): void {
  for (const a of addresses) {
    const aboveThreshold = a.relevance > ADDRESS_MATCH_RELEVANCE_THRESHOLD;
    if (!aboveThreshold) {
      const msg = `Low address match coefficient`;
      console.log(`${msg}. Address: ${a.address}, Relevance: ${a.relevance}`);
      capture.message(msg, {
        extra: {
          context: `getCoordinatesFromLocation`,
          relevance: a.relevance,
          address: a.address,
          suggestedAddress: a.suggestedLabel,
          patient,
          threshold: ADDRESS_MATCH_RELEVANCE_THRESHOLD,
        },
        level: "info",
      });
    }
    if (patient.cxId) {
      analytics({
        distinctId: patient.cxId,
        event: EventTypes.addressRelevance,
        properties: {
          relevance: a.relevance,
          aboveThreshold,
          apiType: Product.medical,
        },
      });
    }
    // TODO: #1327 - automatically email the CX about a bad address
  }
}
