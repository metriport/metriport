import { Address } from "../../../domain/medical/address";
import { Patient } from "../../../domain/medical/patient";
import { Product } from "../../../domain/product";
import { AddressAndSuggestedLabel, addGeographicCoordinates } from "../../../external/aws/address";
import { EventTypes, analytics } from "../../../shared/analytics";
import { capture } from "../../../shared/notifications";
import { PatientUpdateCmd, updatePatient } from "./update-patient";

const ADDRESS_MATCH_RELEVANCE_THRESHOLD = 0.9;

/**
 * Updates the addresses with geographic coordinates.
 * Optionally reports potentially wrong address entries.
 * Optionally updates the patient with the updated addresses.
 *
 * @param patient the Patient to update the addresses for
 * @param reportRelevance optional, boolean to indicate whether to report a bad address to the cx. Defaults to false.
 * @param updatePatientAddresses optional, boolean to indicate whether to update the patient data. Defaults to false.
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
  const addressAndLabel = await addGeographicCoordinates(addresses);
  const updatedAddresses = addressAndLabel.map(p => p.address);
  if (!updatedAddresses.length) return addresses;

  if (reportRelevance) reportLowRelevance(addressAndLabel, patient);
  if (updatePatientAddresses) {
    const { id, cxId, eTag } = patient;
    const patientUpdatedData: PatientUpdateCmd = {
      ...patient.data,
      address: addresses,
      id,
      cxId,
      eTag,
    };
    await updatePatient(patientUpdatedData);
  }
  return addresses;
};

/**
 * Updates the addresses with geographic coordinates.
 *
 * @param addresses - a list of Address objects.
 * @returns - a list of Address objects with updated coordinates.
 */
export async function addCoordinatesToAddresses(addresses: Address[]): Promise<Address[]> {
  await addGeographicCoordinates(addresses);
  return addresses;
}

export async function reportLowRelevance(
  addresses: AddressAndSuggestedLabel[],
  patient: Patient
): Promise<void> {
  for (const a of addresses) {
    let aboveThreshold = true;
    if (a.relevance < ADDRESS_MATCH_RELEVANCE_THRESHOLD) {
      aboveThreshold = false;
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
    analytics({
      distinctId: patient.cxId,
      event: EventTypes.addressRelevance,
      properties: {
        relevance: a.relevance,
        aboveThreshold,
        apiType: Product.medical,
      },
    });
    // TODO: #1327 - automatically email the CX about a bad address
  }
}
