import { PatientData } from "../domain/patient";
import { PatientMPI } from "./shared";

export interface MPI {
  findMatchingPatient(patient: PatientData): Promise<PatientMPI | undefined>;
}
