import {
  Patient,
  PatientCreate as PatientCreateModel,
  PatientData,
  PatientModel,
} from "../../../models/medical/patient";
import { sanitize, validate } from "./shared";

type Identifier = Pick<Patient, "cxId"> & { facilityId: string };
type PatientNoExternalData = Omit<PatientData, "externalData">;
export type PatientCreateCmd = PatientNoExternalData & Identifier;

export const createPatient = async (patient: PatientCreateCmd): Promise<Patient> => {
  const { cxId, facilityId } = patient;

  const sanitized = sanitize(patient);
  validate(sanitized);

  const { firstName, lastName, dob, genderAtBirth, personalIdentifiers, address, contact } =
    sanitized;
  const patientCreate: PatientCreateModel & Pick<Patient, "id"> = {
    id: "", // the patient id will be generated on the beforeCreate hook
    patientNumber: 0, // this will be generated on the beforeCreate hook
    cxId,
    facilityIds: [facilityId],
    data: { firstName, lastName, dob, genderAtBirth, personalIdentifiers, address, contact },
  };

  return PatientModel.create(patientCreate);
};
