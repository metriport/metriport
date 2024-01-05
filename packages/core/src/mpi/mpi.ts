import { PatientData } from "../domain/medical/patient";
import { PatientMPI } from "./shared";

export interface MPI {
  findMatchingPatient(patient: PatientData): Promise<PatientMPI | undefined>;
}
