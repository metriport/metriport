import { Patient } from "../domain/patient";
import { PatientMPI } from "./shared";

export type MergeProtocol = (patients: Patient[], currentPatient?: Patient) => Patient | undefined;

export function useFirstMatchingPatient(patients: PatientMPI[]): PatientMPI | undefined {
  return patients[0];
}
