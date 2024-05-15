import { Patient, PatientData } from "../domain/patient";
import { PatientLoader } from "../command/patient-loader";
import {
  jaroWinklerSimilarity,
  matchingContactDetailsRule,
  matchingPersonalIdentifiersRule,
  matchPatients,
} from "./match-patients";
import { useFirstMatchingPatient } from "./merge-patients";
import { normalizePatient } from "./normalize-patient";
import { patientToPatientMPI } from "./shared";
import { log } from "../util/log";
import { capture } from "../util/notifications";

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

  foundPatients.sort(
    (a: Patient, b: Patient) => a.createdAt.getMilliseconds() - b.createdAt.getMilliseconds()
  );

  // Convert patients to proper datatype
  // Match the found patients with the normalized patient using the similarity function
  const matchingPatients = matchPatients(
    jaroWinklerSimilarity,
    [matchingPersonalIdentifiersRule, matchingContactDetailsRule],
    foundPatients.map(patientToPatientMPI),
    normalizedPatientDemo,
    SIMILARITY_THRESHOLD,
    false
  );

  if (matchingPatients.length > 1) {
    log(
      `WARNING: matchPatients in getPatientByDemo for demo: ${JSON.stringify(
        demo
      )} and cxId: ${cxId} is returning more than one matched patient!`
    );
    capture.message("matchPatients in getPatientByDemo returning more than one matched patient!", {
      extra: {
        context: `mpi.getPatientByDemo`,
        cxId,
        demo,
      },
      level: "warning",
    });
  }
  // Merge the matching patients
  const mpiPatient = useFirstMatchingPatient(matchingPatients);
  if (!mpiPatient) return undefined;

  return patientLoader.getOneOrFail({ id: mpiPatient.id, cxId });
};
