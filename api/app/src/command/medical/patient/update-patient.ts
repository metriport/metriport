import { Patient, PatientData } from "../../../models/medical/patient";
import { validateVersionForUpdate } from "../../../models/_default";
import { getPatient } from "./get-patient";
import { sanitize, validate } from "./shared";

type PatientBasic = Pick<Patient, "id" | "cxId" | "eTag">;
type PatientNoExternalData = Omit<PatientData, "externalData">;
export type PatientUpdateCmd = PatientBasic & PatientNoExternalData;

export const updatePatient = async (patientUpdate: PatientUpdateCmd): Promise<Patient> => {
  const { id, cxId, eTag } = patientUpdate;

  const sanitized = sanitize(patientUpdate);
  validate(sanitized);

  const patient = await getPatient({ id, cxId });
  validateVersionForUpdate(patient, eTag);

  return patient.update({
    data: {
      firstName: sanitized.firstName,
      lastName: sanitized.lastName,
      dob: sanitized.dob,
      genderAtBirth: sanitized.genderAtBirth,
      personalIdentifiers: sanitized.personalIdentifiers,
      address: sanitized.address,
      contact: sanitized.contact,
    },
  });
};
