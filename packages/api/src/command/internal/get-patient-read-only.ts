import { Patient } from "@metriport/core/domain/patient";
import { NotFoundError } from "@metriport/shared";
import { PatientModelReadOnly } from "../../models/medical/patient-readonly";

/**
 * ⚠️ INTERNAL/OPS USE ONLY ⚠️
 *
 * This function does NOT require cxId and should ONLY be used for:
 * - Internal endpoints (/internal/*)
 * - Ops/automation scripts
 *
 * DO NOT use in customer-facing features. Use getPatientReadOnly() from
 * command/medical/patient/get-patient-read-only.ts instead, which requires cxId
 * and enforces customer data isolation.
 *
 * Get a patient from the read-only database instance by patient ID only.
 *
 * @param patientId - The id of the patient
 * @returns The patient or undefined if the patient does not exist
 */
export async function internalOnlyGetPatientReadOnlyById(
  patientId: string
): Promise<Patient | undefined> {
  const patient = await PatientModelReadOnly.findByPk(patientId);
  if (!patient) return undefined;
  return patient.dataValues;
}

/**
 * ⚠️ INTERNAL/OPS USE ONLY ⚠️
 *
 * This function does NOT require cxId and should ONLY be used for:
 * - Internal endpoints (/internal/*)
 * - Ops/automation scripts
 *
 * DO NOT use in customer-facing features. Use getPatientReadOnlyOrFail() from
 * command/medical/patient/get-patient-read-only.ts instead, which requires cxId
 * and enforces customer data isolation.
 *
 * Get a patient from the read-only database instance by patient ID only.
 * Throws an error if the patient does not exist.
 *
 * @param patientId - The id of the patient
 * @returns The patient
 */
export async function internalOnlyGetPatientReadOnlyByIdOrFail(
  patientId: string
): Promise<Patient> {
  const patient = await internalOnlyGetPatientReadOnlyById(patientId);
  if (!patient) throw new NotFoundError("Patient not found");
  return patient;
}
