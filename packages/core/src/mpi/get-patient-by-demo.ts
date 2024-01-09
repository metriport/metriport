import { Patient, PatientData } from "../domain/patient";
import { PatientLoader } from "../domain/patient-loader";
import {
  jaroWinklerSimilarity,
  matchingContactDetailsRule,
  matchingPersonalIdentifiersRule,
  matchPatients,
} from "./match-patients";
import { useFirstMatchingPatient } from "./merge-patients";
import { normalizePatient } from "./normalize-patient";
import { patientToPatientMPI } from "./shared";

const SIMILARITY_THRESHOLD = 0.96;

/**
 * Retrieves a patient based on their demographic information. Utilizes functions
 * from the MPI: normalization, finding(blocking), matching, merging
 *
 * @param cxId - The ID of the patient in the external system.
 * @param demo - The demographic information of the patient.
 * @returns The matched patient object if found, otherwise undefined.
 */
export const getPatientByDemo = async ({
  cxId,
  demo,
  patientLoader,
}: {
  cxId: string;
  demo: PatientData;
  patientLoader: PatientLoader;
}): Promise<Patient | undefined> => {
  // Normalize the patient demographic data
  const normalizedPatientDemo = normalizePatient(demo);
  if (!normalizedPatientDemo) return undefined;

  // Find patients based on the criteria of matching dob and genderAtBirth
  const foundPatients = await patientLoader.findBySimilarity({
    cxId,
    data: {
      dob: normalizedPatientDemo.dob,
      genderAtBirth: normalizedPatientDemo.genderAtBirth,
    },
  });

  // Convert patients to proper datatype
  // Match the found patients with the normalized patient using the similarity function
  const matchingPatients = matchPatients(
    jaroWinklerSimilarity,
    [matchingPersonalIdentifiersRule, matchingContactDetailsRule],
    foundPatients.map(patientToPatientMPI),
    normalizedPatientDemo,
    SIMILARITY_THRESHOLD
  );

  // Merge the matching patients
  const mpiPatient = useFirstMatchingPatient(matchingPatients);
  if (!mpiPatient) return undefined;

  return patientLoader.getOneOrFail({ id: mpiPatient.id, cxId });
};
