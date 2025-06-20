import { Patient } from "@metriport/core/domain/patient";
import { NotFoundError } from "@metriport/shared";
import { Op } from "sequelize";
import { PatientModelReadOnly } from "../../../models/medical/patient-readonly";

/**
 * Get a patient from the read-only database instance.
 *
 * @param cxId - The cxId of the patient
 * @param patientId - The id of the patient
 * @returns The patient or undefined if the patient does not exist
 */
export async function getPatientReadOnly({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<Patient | undefined> {
  const patient = await PatientModelReadOnly.findOne({ where: { cxId, id: patientId } });
  if (!patient) return undefined;
  return patient.dataValues;
}

/**
 * Get a patient from the read-only database instance.
 * Throws an error if the patient does not exist.
 *
 * @param cxId - The cxId of the patient
 * @param patientId - The id of the patient
 * @returns The patient
 */
export async function getPatientReadOnlyOrFail({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<Patient> {
  const patient = await getPatientReadOnly({ cxId, patientId });
  if (!patient) throw new NotFoundError("Patient not found");
  return patient;
}

/**
 * Get the IDs of patients from the read-only database instance.
 *
 * @param cxId - The cx ID
 * @param facilityId - The facility ID (optional, doesn't filter by facility if omitted)
 * @param ids - The IDs of the patients to get (optional, if omitted, all patients are returned)
 * @returns The IDs of the patients
 */
export async function getPatientIds({
  facilityId,
  cxId,
  ids,
}: {
  facilityId?: string;
  cxId: string;
  ids?: string[];
}): Promise<string[]> {
  const patients = await PatientModelReadOnly.findAll({
    attributes: ["id"],
    where: {
      cxId,
      ...(ids && ids.length > 0 ? { id: { [Op.in]: ids } } : undefined),
      ...(facilityId
        ? {
            facilityIds: {
              [Op.contains]: [facilityId],
            },
          }
        : undefined),
    },
  });
  return patients.map(p => p.dataValues.id);
}
