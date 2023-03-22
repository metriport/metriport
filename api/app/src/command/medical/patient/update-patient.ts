import { Patient, PatientData } from "../../../models/medical/patient";
import { validateVersionForUpdate } from "../../../models/_default";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getPatientOrFail } from "./get-patient";
import { sanitize, validate } from "./shared";

type PatientNoExternalData = Omit<PatientData, "externalData">;
export type PatientUpdateCmd = BaseUpdateCmdWithCustomer & PatientNoExternalData;

export const updatePatient = async (patientUpdate: PatientUpdateCmd): Promise<Patient> => {
  const { id, cxId, eTag } = patientUpdate;

  const sanitized = sanitize(patientUpdate);
  validate(sanitized);

  const patient = await getPatientOrFail({ id, cxId });
  validateVersionForUpdate(patient, eTag);

  return patient.update({
    data: {
      ...patient.data,
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
