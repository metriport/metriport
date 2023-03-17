import {
  Patient,
  PatientCreate as PatientCreateModel,
  PatientData,
} from "../../../models/medical/patient";
import { sanitize, validate } from "./shared";

type Identifier = Pick<Patient, "cxId"> & { facilityId: string };
type PatientNoExternalData = Omit<PatientData, "externalData">;
export type PatientCreate = PatientNoExternalData & Identifier;

export const createPatient = async (patient: PatientCreate): Promise<Patient> => {
  const { cxId, facilityId } = patient;

  const sanitized = sanitize(patient);
  validate(sanitized);

  const newPatient: PatientCreateModel & Pick<Patient, "id"> = {
    id: "", // the patient id will be generated on the beforeCreate hook
    patientNumber: 0, // this will be generated on the beforeCreate hook
    cxId,
    facilityIds: [facilityId],
    data: {
      firstName: sanitized.firstName,
      lastName: sanitized.lastName,
      dob: sanitized.dob,
      genderAtBirth: sanitized.genderAtBirth,
      personalIdentifiers: sanitized.personalIdentifiers,
      address: sanitized.address,
      contact: sanitized.contact,
    },
  };

  return Patient.create(newPatient);
};
