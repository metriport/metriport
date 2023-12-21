import { uniqBy } from "lodash";
import { Address } from "../../../domain/medical/address";
import { Patient } from "../../../domain/medical/patient";
import { Product } from "../../../domain/product";
import { AddressGeocodingResult } from "../../../external/aws/address";
import { EventTypes, analytics } from "../../../shared/analytics";
import { capture } from "../../../shared/notifications";
import { PatientUpdateCmd, updatePatient } from "./update-patient";
import { generateGeocodedAddresses } from "../address/generate-geocoded-addresses";

const ADDRESS_MATCH_RELEVANCE_THRESHOLD = 0.9;

/**
 * Updates the addresses with geographic coordinates.
 * Optionally reports potentially wrong address entries.
 * Optionally updates the patient with the updated addresses.
 *
 * @param patient - the Patient to update the addresses for
 * @param reportRelevance - optional, boolean to indicate whether to report a bad address to the cx. Defaults to false.
 * @param updatePatientAddresses - optional, boolean to indicate whether to update the patient data. Defaults to false.
 * @returns list of Addresses
 */
export const upsertGeographicCoordinates = async ({
  patient,
  reportRelevance = false,
  updatePatientAddresses = false,
}: {
  patient: Patient;
  reportRelevance?: boolean;
  updatePatientAddresses?: boolean;
}): Promise<Address[]> => {
  const addresses = patient.data.address;
  const geocodedAddressResults = await generateGeocodedAddresses(addresses);
  const updatedAddresses = geocodedAddressResults.map(p => p.address);
  if (!updatedAddresses.length) return addresses;
  const addressesWithCoordinates = uniqBy([...updatedAddresses, ...addresses], "addressLine1");

  if (reportRelevance) reportLowRelevance(geocodedAddressResults, patient);
  if (updatePatientAddresses) {
    const { id, cxId, eTag } = patient;
    const patientUpdatedData: PatientUpdateCmd = {
      ...patient.data,
      address: addressesWithCoordinates,
      id,
      cxId,
      eTag,
    };
    await updatePatient(patientUpdatedData);
  }
  return addressesWithCoordinates;
};

/**
 * Updates the addresses with geographic coordinates.
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
  const updatedAddresses = await generateGeocodedAddresses(addresses);
  if (reportRelevance) await reportLowRelevance(updatedAddresses, patient);
  return addresses;
}

export async function reportLowRelevance(
  addresses: AddressGeocodingResult[],
  patient: Partial<Patient>
): Promise<void> {
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
