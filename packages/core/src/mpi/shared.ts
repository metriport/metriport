import { Patient, PatientData } from "../domain/patient/patient";

export type PatientMPI = Pick<Patient, "id"> & PatientData;

export function patientToPatientMPI(patient: Patient): PatientMPI {
  return {
    id: patient.id,
    ...patient.data,
  };
}

export function patientMPIToPartialPatient(patient: PatientMPI): Pick<Patient, "id" | "data"> {
  const { id, ...data } = patient;
  return { id, data };
}
