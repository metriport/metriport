import { out } from "@metriport/core/util";
import { Op } from "sequelize";
import { PatientCohortModel } from "../../../../models/medical/patient-cohort";
import { MetriportError } from "@metriport/shared";
import { getCohortModelOrFail } from "../get-cohort";

type RemovePatientsFromCohortCmd = {
  cohortId: string;
  cxId: string;
  patientIds: string[];
};

export async function removePatientsFromCohort({
  cohortId,
  cxId,
  patientIds,
}: RemovePatientsFromCohortCmd): Promise<void> {
  const { log } = out(`removePatientsFromCohort - cx ${cxId}, cohort ${cohortId}`);

  if (patientIds.length < 1) return;

  await getCohortModelOrFail({ cohortId, cxId });

  const existingPatientCohorts = await PatientCohortModel.findAll({
    where: { cohortId, patientId: { [Op.in]: patientIds } },
    attributes: ["patientId"],
  });

  const existingPatientIds = existingPatientCohorts.map(pc => pc.patientId);
  const existingSet = new Set(existingPatientIds);
  const missingPatientIds = patientIds.filter(id => !existingSet.has(id));

  if (missingPatientIds.length > 0) {
    throw new MetriportError(`Patients were not found in the cohort.`, undefined, {
      cohortId,
      requestedCount: patientIds.length,
      failedToDeletePatientIds: missingPatientIds.join(", "),
    });
  }

  const deletedCount = await PatientCohortModel.destroy({
    where: { cohortId, patientId: { [Op.in]: existingPatientIds } },
  });

  log(`Removed ${deletedCount} patients from cohort`);
}

export async function removeAllPatientsFromCohort({
  cohortId,
  cxId,
}: {
  cohortId: string;
  cxId: string;
}): Promise<void> {
  const { log } = out(`removeAllPatientsFromCohort - cx ${cxId}, cohort ${cohortId}`);
  await getCohortModelOrFail({ cohortId, cxId });

  const deletedCount = await PatientCohortModel.destroy({
    where: { cohortId },
  });
  log(`Removed ${deletedCount} patients from cohort`);
}
