import { out } from "@metriport/core/util";
import {
  AssignOrRemovePatientsToRosterCmd,
  BadRequestError,
  isRosterClosed,
} from "@metriport/shared";
import { strictlyValidateAllAndPatientIds } from "@metriport/shared/domain/patient-or-all";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { PatientRosterModel } from "../../../../models/medical/patient-roster";
import { getPatientIds } from "../../patient/get-patient-read-only";
import { verifyPatients } from "../../patient/settings/common";
import { getRosterOrFail } from "../get-roster";

/**
 * Parameters for assigning patients to a roster.
 *
 * @param rosterId - The ID of the roster to assign patients to.
 * @param cxId - The customer ID.
 * @param patientIds - Optional list of patient IDs to assign. Mutually exclusive with isAssignAll.
 * @param allPatients - Flag to assign all patients. Mutually exclusive with patientIds.
 * @param overrideClose - Flag to override the roster status check.
 * @returns The number of patients assigned to the roster.
 * @throws BadRequestError if the roster is closed and overrideClose is false.
 */
export async function assignPatientsToRoster({
  rosterId,
  cxId,
  patientIds: patientIdsParam,
  allPatients,
  overrideClose = false,
}: AssignOrRemovePatientsToRosterCmd): Promise<number> {
  const { log } = out(`assignPatientsToRoster - rosterId ${rosterId} cxId ${cxId}`);
  strictlyValidateAllAndPatientIds({ patientIds: patientIdsParam, allPatients });
  const roster = await getRosterOrFail({
    rosterId,
    cxId,
  });
  if (isRosterClosed(roster.status) && !overrideClose) {
    const msg = `Cannot assign patients to a ${roster.status} roster`;
    log(msg);
    throw new BadRequestError(msg, undefined, {
      rosterId,
      cxId,
      status: roster.status,
    });
  }
  const { validPatientIds, invalidPatientIds } = await parseAndverifyPatientIds({
    allPatients,
    patientIds: patientIdsParam,
    cxId,
  });
  if (invalidPatientIds.length > 0) {
    throw new BadRequestError(`Invalid patient IDs provided`, undefined, {
      rosterId,
      cxId,
      invalidPatientCount: invalidPatientIds.length,
    });
  }
  const assignments = validPatientIds.map(patientId => ({
    id: uuidv7(),
    patientId,
    rosterId,
  }));
  const createdAssignments = await PatientRosterModel.bulkCreate(assignments, {
    ignoreDuplicates: true,
  });
  log(`Assigned ${createdAssignments.length}/${validPatientIds.length} patients to roster`);
  return createdAssignments.length;
}

export async function parseAndverifyPatientIds({
  allPatients,
  patientIds,
  cxId,
}: {
  allPatients?: boolean;
  patientIds?: string[];
  cxId: string;
}): Promise<{ validPatientIds: string[]; invalidPatientIds: string[] }> {
  strictlyValidateAllAndPatientIds({ patientIds, allPatients });
  if (allPatients) {
    const allPatientIds = await getPatientIds({ cxId });
    return { validPatientIds: allPatientIds, invalidPatientIds: [] };
  }
  return await verifyPatients({
    patientIds: [...new Set(patientIds)],
    cxId,
  });
}
