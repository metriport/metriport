import { Patient, PatientData } from "../../../domain/medical/patient";
import { validateVersionForUpdate } from "../../../models/_default";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getPatientOrFail } from "./get-patient";
import { sanitize, validate } from "./shared";

type PatientNoExternalData = Omit<PatientData, "externalData">;
export type PatientUpdateCmd = BaseUpdateCmdWithCustomer & PatientNoExternalData;

// TODO build unit test to validate the patient is being sent correctly to Sequelize
// See: document-query.test.ts, "send a modified object to Sequelize"
// See: https://metriport.slack.com/archives/C04DMKE9DME/p1686779391180389
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
