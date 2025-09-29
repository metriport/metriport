import { out } from "@metriport/core/util";
import { Op } from "sequelize";
import { PatientCohortModel } from "../../../../models/medical/patient-cohort";

type BulkRemovePatientsFromCohortParams = {
  cohortId: string;
  cxId: string;
  patientIds: string[];
};

export async function bulkRemovePatientsFromCohort({
  cohortId,
  cxId,
  patientIds,
}: BulkRemovePatientsFromCohortParams): Promise<number> {
  const { log } = out(`bulkRemovePatientsFromCohort - cx ${cxId}, cohort ${cohortId}`);

  const deletedCount = await PatientCohortModel.destroy({
    where: { cohortId, patientId: { [Op.in]: patientIds } },
  });
  log(`Removed ${deletedCount} patients from cohort ${cohortId}`);

  return deletedCount;
}
