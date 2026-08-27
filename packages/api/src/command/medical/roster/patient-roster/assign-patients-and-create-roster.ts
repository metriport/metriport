import {
  AssignPatientsAndCreateRosterCmd,
  AssignPatientsToRosterResponse,
} from "@metriport/shared";
import { strictlyValidateAllAndPatientIds } from "@metriport/shared/domain/patient-or-all";
import { createRoster } from "../create-roster";
import { getLatestRoster } from "../get-roster";
import { assignPatientsToRoster } from "./assign-patients-to-roster";

/**
 * Assigns patients to a roster. If the roster doesn't exist, creates it first.
 *
 * @param cxId - The customer ID.
 * @param source - Source for the roster (required if creating a new roster).
 * @param type - Roster type (required if creating a new roster).
 * @param data - Data for the roster (optional).
 * @param patientIds - Optional list of patient IDs to assign. Mutually exclusive with isAssignAll.
 * @param allPatients - Flag to assign all patients. Mutually exclusive with patientIds.
 * @returns The roster and the number of patients assigned.
 */
export async function assignPatientsAndCreateRoster({
  cxId,
  source,
  type,
  data,
  patientIds,
  allPatients,
}: AssignPatientsAndCreateRosterCmd): Promise<AssignPatientsToRosterResponse> {
  strictlyValidateAllAndPatientIds({ patientIds, allPatients });
  let roster = await getLatestRoster({ cxId, source, type, status: "open" });
  if (!roster) {
    roster = await createRoster({
      cxId,
      source,
      type,
      data,
    });
  }
  const count = await assignPatientsToRoster({
    rosterId: roster.id,
    cxId,
    patientIds,
    allPatients,
  });
  return { roster, count };
}
