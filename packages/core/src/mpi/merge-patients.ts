import { Patient } from "../domain/patient";
import { PatientMPI } from "./shared";

export type MergeProtocol = (patients: Patient[], currentPatient?: Patient) => Patient | undefined;

export function useFirstMatchingPatient(patients: PatientMPI[]): PatientMPI | undefined {
  if (patients.length === 0) return undefined;
  if (patients.length === 1) return patients[0];

  return patients[0];
}
