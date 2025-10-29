import { BadRequestError } from "@metriport/shared";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { PatientCohortModel } from "../../../../models/medical/patient-cohort";

type AddPatientToCohortsParams = {
  patientId: string;
  cxId: string;
  cohortIds: string[];
};

export async function addPatientToCohorts({
  patientId,
  cxId,
  cohortIds,
}: AddPatientToCohortsParams): Promise<void> {
  if (cohortIds.length === 0) {
    throw new BadRequestError("No cohort IDs provided in request.", undefined, { patientId });
  }

  const uniqueCohortIds = [...new Set(cohortIds)];

  const patientCohortRows = uniqueCohortIds.map(cohortId => ({
    id: uuidv7(),
    cxId,
    patientId,
    cohortId,
  }));

  await PatientCohortModel.bulkCreate(patientCohortRows, {
    ignoreDuplicates: true,
  });

  return;
}
