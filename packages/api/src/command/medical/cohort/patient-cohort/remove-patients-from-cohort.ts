import { out } from "@metriport/core/util";
import { Op } from "sequelize";
import { PatientCohortModel } from "../../../../models/medical/patient-cohort";

type RemovePatientsFromCohortParams = {
  cohortId: string;
  cxId: string;
  patientIds: string[];
};

export async function removePatientsFromCohort({
  cohortId,
  cxId,
  patientIds,
}: RemovePatientsFromCohortParams): Promise<void> {
  const { log } = out(`removePatientsFromCohort - cx ${cxId}, cohort ${cohortId}`);

  const deletedCount = await PatientCohortModel.destroy({
    where: { cohortId, patientId: { [Op.in]: patientIds } },
  });
  log(`Removed ${deletedCount} patients from cohort ${cohortId}`);

  return;
}
