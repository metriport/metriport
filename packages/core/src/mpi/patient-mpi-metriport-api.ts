import { PatientLoaderMetriportAPI } from "../command/patient-loader-metriport-api";
import { PatientData } from "../domain/patient/patient";
import {
  exactMatchSimilarity,
  matchingPersonalIdentifiersRule,
  matchPatients,
} from "./match-patients";
import { mergeWithFirstPatient } from "./merge-patients";
import { MPI } from "./mpi";
import { normalizePatient } from "./normalize-patient";
import { PatientMPI, patientToPatientMPI } from "./shared";

export class MPIMetriportAPI implements MPI {
  protected readonly SIMILARITY_THRESHOLD = 0.96;
  protected readonly patientLoader = new PatientLoaderMetriportAPI(this.apiUrl);

  constructor(protected apiUrl: string) {}

  public async findMatchingPatient(patient: PatientData): Promise<PatientMPI | undefined> {
    const normalizedPatientDemo = normalizePatient(patient);
    if (!normalizedPatientDemo) throw new Error("Invalid Patient Data");

    const foundPatients = await this.patientLoader.findBySimilarityAcrossAllCxs({
      data: {
        dob: normalizedPatientDemo.dob,
        genderAtBirth: normalizedPatientDemo.genderAtBirth,
      },
    });
    const matchingPatients = matchPatients(
      exactMatchSimilarity,
      [matchingPersonalIdentifiersRule],
      foundPatients.map(patientToPatientMPI),
      normalizedPatientDemo,
      this.SIMILARITY_THRESHOLD
    );
    return mergeWithFirstPatient(matchingPatients, normalizedPatientDemo);
  }
}
