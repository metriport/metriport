import { Patient, PatientData } from "@metriport/core/domain/patient";
import { createPatient } from "./create-patient";
import { getPatientByDemoStrict, PatientWithIdentifiers } from "./get-patient";
import { updatePatient } from "./update-patient";

type Identifier = Pick<Patient, "cxId" | "externalId"> & { facilityId: string };
type PatientNoExternalData = Omit<PatientData, "externalData">;
export type PatientCreateCmd = PatientNoExternalData & Identifier;

/**
 * Creates or updates a patient based on the demo data.
 * Performs a strict match on the patient's demographic information:
 * - all must match:
 *   - firstName
 *   - lastName
 *   - dob
 *   - genderAtBirth
 * - address.zip: at least one zip must match, unless the patient has no address, in which case
 *   the patient is matched
 *
 * NOTE: patientCreate returns the existing patient based on SIMILARITY matching, not strict
 * matching. So, if strict matching decides that two patients are not the same (let's say the
 * zip is different), patientCreate might still consider them the same because it does a
 * similarity match - in which case, it returns the existing patient, without updating it.
 *
 * @param patientCreate - The patient to be created or updated.
 * @param runPd - Whether to run PD.
 * @param rerunPdOnNewDemographics - Whether to rerun PD on new demographics.
 * @param forceCommonwell - Whether to force Commonwell.
 * @param forceCarequality - Whether to force Carequality.
 * @param cohortIds - The cohort IDs.
 * @param contextId - The context ID, used to represent the request/invocation for this function.
 * @returns The patient and a boolean indicating if it was created or updated.
 */
export async function createOrUpdatePatientBasedOnDemo({
  patientCreate,
  runPd,
  rerunPdOnNewDemographics,
  forceCommonwell,
  forceCarequality,
  cohortIds,
  contextId,
}: {
  patientCreate: PatientCreateCmd;
  runPd?: boolean;
  rerunPdOnNewDemographics?: boolean;
  forceCommonwell?: boolean;
  forceCarequality?: boolean;
  cohortIds?: string[];
  contextId?: string;
}): Promise<{ patient: PatientWithIdentifiers; created: boolean }> {
  const { cxId } = patientCreate;

  const matchedPatient = await getPatientByDemoStrict({
    cxId,
    demo: patientCreate,
    contextId,
  });
  if (matchedPatient) {
    const patient = await updatePatient({
      patientUpdate: {
        ...patientCreate,
        id: matchedPatient.id,
      },
      runPd,
      rerunPdOnNewDemographics,
      forceCommonwell,
      forceCarequality,
      cohortIds,
    });
    return { patient, created: false };
  }
  const patient = await createPatient({
    patient: patientCreate,
    runPd,
    rerunPdOnNewDemographics,
    forceCommonwell,
    forceCarequality,
    cohortIds,
  });
  // Note: see note on the function's TSDoc about patientCreate and similarity vs. strict matching
  return { patient, created: true };
}
