import {
  Patient,
  PatientCreate as PatientCreateModel,
  PatientData,
} from "../../../models/medical/patient";

type Identifier = Pick<Patient, "cxId"> & { facilityId: string };
type PatientNoExternalData = Omit<PatientData, "externalData">;
type PatientCreate = PatientNoExternalData & Identifier;

export const createPatient = async (patient: PatientCreate): Promise<Patient> => {
  const { cxId, facilityId } = patient;

  const newPatient: PatientCreateModel & Pick<Patient, "id"> = {
    id: "", // the patient id will be generated on the beforeCreate hook
    patientNumber: 0, // this will be generated on the beforeCreate hook
    cxId,
    facilityIds: [facilityId],
    data: {
      firstName: patient.firstName,
      lastName: patient.lastName,
      dob: patient.dob,
      gender: patient.gender,
      driversLicense: patient.driversLicense,
      address: patient.address,
      contact: patient.contact,
    },
  };

  return Patient.create(newPatient);
};
