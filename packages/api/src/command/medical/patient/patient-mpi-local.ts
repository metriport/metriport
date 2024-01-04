import {
  matchPatients,
  jaroWinklerSimilarity,
  matchingPersonalIdentifiersRule,
  matchingContactDetailsRule,
} from "@metriport/core/mpi/match-patients";
import { normalizePatient } from "@metriport/core/mpi/normalize-patient";
import { mergeWithFirstPatient } from "@metriport/core/mpi/merge-patients";
import { MPI } from "@metriport/core/mpi/mpi";
import { PatientFinderLocal } from "./patient-finder-local";
import { Patient } from "../../../domain/medical/patient";

const SIMILARITY_THRESHOLD = 0.96;

export class MPILocal extends MPI {
  public async findMatchingPatient(patient: Patient, cxId?: string): Promise<Patient | undefined> {
    // Normalize the patient demographic data
    const normalizedPatientDemo = normalizePatient(patient);
    if (!normalizedPatientDemo) return undefined;

    // Find patients based on the criteria of matching dob and genderAtBirth
    const patientFinder = new PatientFinderLocal();
    const foundPatients = await patientFinder.find({
      cxId,
      data: {
        dob: normalizedPatientDemo.data.dob,
        genderAtBirth: normalizedPatientDemo.data.genderAtBirth,
      },
    });

    // Convert patients to proper datatype
    // Match the found patients with the normalized patient using the similarity function
    const matchingPatients = matchPatients(
      jaroWinklerSimilarity,
      [matchingPersonalIdentifiersRule, matchingContactDetailsRule],
      foundPatients,
      normalizedPatientDemo,
      SIMILARITY_THRESHOLD
    );

    // Merge the matching patients
    return mergeWithFirstPatient(matchingPatients, normalizedPatientDemo);
  }
}
