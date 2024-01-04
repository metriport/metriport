import { Patient } from "../domain/patient/patient";
import { MPI } from "../mpi/mpi";
import {
  matchPatients,
  exactMatchSimilarity,
  matchingPersonalIdentifiersRule,
} from "../mpi/match-patients";
import { normalizePatient } from "../mpi/normalize-patient";
import { mergeWithFirstPatient } from "../mpi/merge-patients";
import { PatientFinderMetriportAPI } from "./patient-finder-metriport-api";
import { getEnvVarOrFail } from "../util/env-var";

const apiUrl = getEnvVarOrFail("API_URL");
const SIMILARITY_THRESHOLD = 0.96;

export class MPIMetriportAPI extends MPI {
  public async findMatchingPatient(patient: Patient): Promise<Patient | undefined> {
    const normalizedPatientDemo = normalizePatient(patient);
    if (!normalizedPatientDemo) throw new Error("Invalid Patient Data");
    const patientFinder = new PatientFinderMetriportAPI(apiUrl);
    const foundPatients = await patientFinder.find({
      data: {
        dob: normalizedPatientDemo.data.dob,
        genderAtBirth: normalizedPatientDemo.data.genderAtBirth,
      },
    });
    const matchingPatients = matchPatients(
      exactMatchSimilarity,
      [matchingPersonalIdentifiersRule],
      foundPatients,
      normalizedPatientDemo,
      SIMILARITY_THRESHOLD
    );
    return mergeWithFirstPatient(matchingPatients, normalizedPatientDemo);
  }
}
