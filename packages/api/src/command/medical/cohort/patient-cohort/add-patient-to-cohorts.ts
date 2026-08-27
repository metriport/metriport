import { CohortWithSize, NotFoundError } from "@metriport/shared";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { PatientCohortModel } from "../../../../models/medical/patient-cohort";
import { CohortModel } from "../../../../models/medical/cohort";
import { getPatientOrFail } from "../../patient/get-patient";
import { listCohortsWithSizesForPatient } from "../get-cohort";

type AddPatientToCohortsCmd = {
  patientId: string;
  cxId: string;
  cohortIds: string[];
};

export async function addPatientToCohorts({
  patientId,
  cxId,
  cohortIds,
}: AddPatientToCohortsCmd): Promise<CohortWithSize[]> {
  if (cohortIds.length < 1) {
    const cohortsWithSizes = await listCohortsWithSizesForPatient({ cxId, patientId });
    return cohortsWithSizes;
  }

  await getPatientOrFail({ id: patientId, cxId });

  const uniqueCohortIds = [...new Set(cohortIds)];

  const cohorts = await CohortModel.findAll({
    where: { id: uniqueCohortIds, cxId },
    attributes: ["id"],
  });

  if (cohorts.length !== uniqueCohortIds.length) {
    const missingCohortIds = uniqueCohortIds.filter(
      cohortId => !cohorts.some(c => c.id === cohortId)
    );
    throw new NotFoundError("Could not find some cohorts.", undefined, {
      cohortIds: missingCohortIds.join(", "),
    });
  }

  const patientCohortRows = uniqueCohortIds.map(cohortId => ({
    id: uuidv7(),
    patientId,
    cohortId,
  }));

  await PatientCohortModel.bulkCreate(patientCohortRows, {
    ignoreDuplicates: true,
  });

  const cohortsWithSizes = await listCohortsWithSizesForPatient({ cxId, patientId });
  return cohortsWithSizes;
}
