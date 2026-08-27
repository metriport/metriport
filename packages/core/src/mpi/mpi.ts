import { PatientDataForMpiMatching } from "./normalize-patient";
import { PatientMPI } from "./shared";

export interface MPI {
  findMatchingPatient(patient: PatientDataForMpiMatching): Promise<PatientMPI | undefined>;
}
