import { out } from "@metriport/core/util";
import {
  AssignOrRemovePatientsToRosterCmd,
  BadRequestError,
  isRosterClosed,
} from "@metriport/shared";
import { strictlyValidateAllAndPatientIds } from "@metriport/shared/domain/patient-or-all";
import { Op } from "sequelize";
import { PatientRosterModel } from "../../../../models/medical/patient-roster";
import { getRosterOrFail } from "../get-roster";

/**
 * Parameters for removing patients from a roster.
 *
 * @param rosterId - The ID of the roster to remove patients from.
 * @param cxId - The customer ID.
 * @param patientIds - Optional list of patient IDs to remove. Mutually exclusive with isRemoveAll.
 * @param allPatients - Flag to remove all patients. Mutually exclusive with patientIds.
 * @param overrideClose - Flag to override the roster status check.
 * @returns The number of patients removed from the roster.
 * @throws BadRequestError if the roster is closed.
 */
export async function removePatientsFromRoster({
  rosterId,
  cxId,
  patientIds: patientIdsParam,
  allPatients,
  overrideClose = false,
}: AssignOrRemovePatientsToRosterCmd): Promise<number> {
  const { log } = out(`removePatientsFromRoster - rosterId ${rosterId} cxId ${cxId}`);
  strictlyValidateAllAndPatientIds({ patientIds: patientIdsParam, allPatients });
  const roster = await getRosterOrFail({
    rosterId,
    cxId,
  });
  if (isRosterClosed(roster.status) && !overrideClose) {
    const msg = `Cannot remove patients from a ${roster.status} roster`;
    log(msg);
    throw new BadRequestError(msg, undefined, {
      rosterId,
      cxId,
      status: roster.status,
    });
  }
  const patientIds = allPatients ? undefined : [...new Set(patientIdsParam ?? [])];
  if (patientIds && patientIds.length > 0) {
    const existingPatientRosters = await PatientRosterModel.findAll({
      where: { rosterId, patientId: { [Op.in]: patientIds } },
      attributes: ["patientId"],
    });
    const existingPatientIds = existingPatientRosters.map(pr => pr.patientId);
    const existingPatientIdsSet = new Set(existingPatientIds);
    const missingPatientIds = patientIds.filter(id => !existingPatientIdsSet.has(id));
    if (missingPatientIds.length > 0) {
      throw new BadRequestError(`Invalid patient IDs provided`, undefined, {
        rosterId,
        cxId,
        missingPatientCount: missingPatientIds.length,
      });
    }
  }
  const deletedCount = await PatientRosterModel.destroy({
    where: allPatients ? { rosterId } : { rosterId, patientId: { [Op.in]: patientIds ?? [] } },
  });
  log(`Removed ${deletedCount} patients from roster`);
  return deletedCount;
}
