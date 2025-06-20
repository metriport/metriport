import { out } from "@metriport/core/util";
import { Op } from "sequelize";
import { PatientCohortModel } from "../../../../models/medical/patient-cohort";
import { allOrSelectPatientIdsRefinedSchema } from "../../../../routes/medical/schemas/shared";
import { getCohortModelOrFail } from "../get-cohort";

type BulkRemovePatientsFromCohortParams = {
  cohortId: string;
  cxId: string;
  patientIds?: string[];
  isRemoveAll?: boolean;
};

export async function bulkRemovePatientsFromCohort({
  cohortId,
  cxId,
  patientIds,
  isRemoveAll,
}: BulkRemovePatientsFromCohortParams): Promise<number> {
  const { log } = out(`bulkRemovePatientsFromCohort - cx ${cxId}, cohort ${cohortId}`);

  allOrSelectPatientIdsRefinedSchema.parse({ patientIds, all: isRemoveAll });
  await getCohortModelOrFail({ id: cohortId, cxId });

  const whereClause = isRemoveAll ? { cohortId } : { cohortId, patientId: { [Op.in]: patientIds } };

  const deletedCount = await PatientCohortModel.destroy({ where: whereClause });
  log(`Removed ${deletedCount} patients from cohort ${cohortId}`);

  return deletedCount;
}
