import { out } from "@metriport/core/util";
import { BadRequestError } from "@metriport/shared";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { PatientCohortModel } from "../../../../models/medical/patient-cohort";
import { CohortModel } from "../../../../models/medical/cohort";

type AddPatientToCohortsParams = {
  patientId: string;
  cxId: string;
  cohortIds: string[];
};

export async function addPatientToCohorts({
  patientId,
  cxId,
  cohortIds,
}: AddPatientToCohortsParams): Promise<{ id: string; name: string; description?: string }[]> {
  const { log } = out(`addPatientToCohorts - cx ${cxId}, patient ${patientId}`);

  if (cohortIds.length === 0) {
    throw new BadRequestError("No cohort IDs provided in request.", undefined, { cxId, patientId });
  }

  const uniqueCohortIds = [...new Set(cohortIds)];

  const patientCohortRows = uniqueCohortIds.map(cohortId => ({
    id: uuidv7(),
    cxId,
    patientId,
    cohortId,
  }));

  const createdPatientCohortRows = await PatientCohortModel.bulkCreate(patientCohortRows, {
    ignoreDuplicates: true,
  });

  const successfullyAddedCohortIds = createdPatientCohortRows.map(row => row.cohortId);
  const cohorts = await CohortModel.findAll({
    where: {
      id: successfullyAddedCohortIds,
      cxId,
    },
    attributes: ["id", "name", "description"],
  });

  log(
    `Assigned patient ${patientId} to ${createdPatientCohortRows.length}/${uniqueCohortIds.length} cohorts`
  );

  return cohorts.map(cohort => ({
    id: cohort.id,
    name: cohort.name,
    description: cohort.description,
  }));
}
