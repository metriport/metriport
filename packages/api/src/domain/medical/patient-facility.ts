import { MetriportError } from "@metriport/core/util/error/metriport-error";
import BadRequestError from "../../errors/bad-request";
import { Patient } from "@metriport/core/domain/patient";

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

/**
 * Returns a facility ID for the given Patient considering an optionally passed facility ID.
 *
 * Fails if the facility ID is not associated w/ the Patient or if no facility ID is passed
 * and the Patient is associated with more than one facility.
 */
export function getFacilityIdOrFail(patient: Patient, facilityId?: string): string {
  if (facilityId) {
    if (!isPatientAssociatedWithFacility(patient, facilityId)) {
      throw new BadRequestError(`Patient not associated with given facility`, undefined, {
        patientId: patient.id,
        facilityId,
      });
    }
    return facilityId;
  }
  if (patient.facilityIds.length > 1) {
    throw new BadRequestError(
      `Patient is associated with more than one facility (facilityId is required)`,
      undefined,
      {
        patientId: patient.id,
        facilityIdCount: patient.facilityIds.length,
        facilityId,
      }
    );
  }
  const chosenFacility = patient.facilityIds[0];
  if (!chosenFacility) {
    throw new MetriportError(`Programming error - patient doesnt have a facility`, undefined, {
      patientId: patient.id,
      facilityIdCount: patient.facilityIds.length,
      facilityId,
    });
  }
  return chosenFacility;
}

/**
 * Utility function to validate that a facility ID is associated with a patient or that the
 * patient only has one facility if none is provided.
 * Throws if not valid.
 */
export function validateOptionalFacilityId(patient: Patient, facilityId?: string): true {
  getFacilityIdOrFail(patient, facilityId);
  return true;
}
