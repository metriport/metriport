import { uniq } from "lodash";
import { Patient } from "../../../domain/medical/patient";
import { Address } from "../../../domain/medical/address";
import { AddressAndRelevance, addGeographicCoordinates } from "../../../external/aws/address";
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
  const data = patient.data;
  const addressesAndRelevanceScores = await addGeographicCoordinates(data.address);
  const updatedAddresses = addressesAndRelevanceScores.map(p => p.address);
  const newAddresses = uniq([...data.address, ...updatedAddresses]);

  if (updatedAddresses.length) {
    if (reportRelevance) reportLowRelevance(addressesAndRelevanceScores, patient);
    if (updatePatientAddresses) {
      const { id, cxId, eTag } = patient;
      const patientUpdatedData: PatientUpdateCmd = {
        ...patient.data,
        address: newAddresses,
        id,
        cxId,
        eTag,
      };
      await updatePatient(patientUpdatedData);
    }
    return newAddresses;
  }
  return data.address;
};

/**
 * Updates the addresses with geographic coordinates.
 *
 * @param addresses - a list of Address objects.
 * @returns - a list of Address objects with updated coordinates.
 */
export async function addCoordinatesToAddresses(addresses: Address[]): Promise<Address[]> {
  const addressesAndRelevanceScores = await addGeographicCoordinates(addresses);
  const updatedAddresses = addressesAndRelevanceScores.map(p => p.address);
  return uniq([...addresses, ...updatedAddresses]);
}

export async function reportLowRelevance(
  addresses: AddressAndRelevance[],
  patient: Patient
): Promise<void> {
  for (const a of addresses) {
    if (a.relevance < ADDRESS_MATCH_RELEVANCE_THRESHOLD) {
      const msg = `Low address match coefficient`;
      console.log(`${msg}. Address: ${a.address}, Relevance: ${a.relevance}`);
      capture.message(msg, {
        extra: {
          context: `getCoordinatesFromLocation`,
          relevance: a.relevance,
          address: a.address,
          patient,
          threshold: ADDRESS_MATCH_RELEVANCE_THRESHOLD,
        },
      });
    }
    // TODO: #1327 - automatically email the CX about a bad address
  }
}
