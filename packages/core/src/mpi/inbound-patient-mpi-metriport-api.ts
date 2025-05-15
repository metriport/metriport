import { PatientLoaderMetriportAPI } from "../command/patient-loader-metriport-api";
import { PatientData } from "../domain/patient";
import { epicMatchingAlgorithm, matchPatients } from "./match-patients";
import { useFirstMatchingPatient } from "./merge-patients";
import { MPI } from "./mpi";
import { normalizePatientInboundMpi } from "./normalize-patient";
import { PatientMPI, patientToPatientMPI } from "./shared";

export class InboundMpiMetriportApi implements MPI {
  protected readonly SIMILARITY_THRESHOLD = 20;
  protected readonly patientLoader = new PatientLoaderMetriportAPI(this.apiUrl);

  constructor(protected apiUrl: string) {}

  public async findMatchingPatient(patient: PatientData): Promise<PatientMPI | undefined> {
    const normalizedPatientDemo = normalizePatientInboundMpi(patient);
    if (!normalizedPatientDemo) throw new Error("Invalid Patient Data");

    const foundPatients = await this.patientLoader.findBySimilarityAcrossAllCxs({
      data: {
        dob: normalizedPatientDemo.dob,
        genderAtBirth: normalizedPatientDemo.genderAtBirth,
      },
    });

    const patientsThatAreOptedIn = foundPatients.filter(patient => !patient.hieOptOut);

    const matchingPatients = matchPatients(
      epicMatchingAlgorithm,
      [],
      patientsThatAreOptedIn.map(patientToPatientMPI),
      normalizedPatientDemo,
      this.SIMILARITY_THRESHOLD
    );

    return useFirstMatchingPatient(matchingPatients);
  }
}
