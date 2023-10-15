import { Patient } from "./patient";

/**
 * Checks if the patient's list of associated facility IDs contains the facility ID parameter passed by the user.
 *
 * @param patient The patient for which to check the association with a facility
 * @param facilityId The ID of the facility passed in by the user
 * @returns a boolean indicating whether this patient is associated with this facility ID
 */
export function isPatientAssociatedWithFacility(patient: Patient, facilityId: string): boolean {
  return patient.facilityIds.some(id => id === facilityId);
}
