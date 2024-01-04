import { PatientData } from "../domain/patient/patient";
import { PatientMPI } from "./shared";

export interface MPI {
  findMatchingPatient(patient: PatientData): Promise<PatientMPI | undefined>;
}
