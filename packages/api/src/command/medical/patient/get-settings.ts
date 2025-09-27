import { CohortSettings } from "@metriport/shared/domain/cohort";
import { mergeWith } from "lodash";
import { getCohortsForPatient } from "../cohort/get-cohort";

/**
 * Used to resolve conflicts between cohorts.
 * If both values are defined, it does a logical and.
 * Otherwise it returns undefined, which allows `mergeWith` to use standard merge behavior.
 * @param a value 1 of the conflict
 * @param b value 2 of the conflict
 * @returns true, false, or undefined
 */
function cohortSettingsConflictResolver(a: unknown, b: unknown) {
  if (a !== undefined && b !== undefined) {
    return a && b;
  }
}

function mergeCohortSettings(cohortArray: CohortSettings[]) {
  return cohortArray.reduce((aggregate, current) =>
    mergeWith(aggregate, current, cohortSettingsConflictResolver)
  );
}

export async function getPatientSettings({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<CohortSettings> {
  const cohorts = await getCohortsForPatient({ cxId, patientId });
  const settings = cohorts.map(_ => _.settings);
  return mergeCohortSettings(settings);
}
