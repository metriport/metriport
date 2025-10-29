import { out } from "@metriport/core/util";
import { BadRequestError } from "@metriport/shared";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { PatientCohortModel } from "../../../../models/medical/patient-cohort";
import { getPatientIds } from "../../patient/get-patient-read-only";

type AddPatientsToCohortParams = {
  cohortId: string;
  cxId: string;
  patientIds: string[];
};

export async function addPatientsToCohort({
  cohortId,
  cxId,
  patientIds,
}: AddPatientsToCohortParams): Promise<void> {
  const { log } = out(`addPatientsToCohort - cx ${cxId}, cohort ${cohortId}`);

  if (patientIds.length === 0) {
    throw new BadRequestError("No patient IDs provided in request.", undefined, { cohortId });
  }

  const uniquePatientIds = [...new Set(patientIds)];

  const patientCohortRows = uniquePatientIds.map(patientId => ({
    id: uuidv7(),
    cxId,
    patientId,
    cohortId,
  }));

  const createdPatientCohortRows = await PatientCohortModel.bulkCreate(patientCohortRows, {
    ignoreDuplicates: true,
  });
  log(
    `Assigned ${createdPatientCohortRows.length}/${uniquePatientIds.length} patients to cohort ${cohortId}`
  );

  return;
}

type AssignAllPatientsToCohortParams = {
  cohortId: string;
  cxId: string;
};

export async function addAllPatientsToCohort({
  cohortId,
  cxId,
}: AssignAllPatientsToCohortParams): Promise<void> {
  const patientIds = await getPatientIds({ cxId });

  const patientCohortRows = patientIds.map(patientId => ({
    id: uuidv7(),
    cxId,
    patientId,
    cohortId,
  }));

  const createdPatientCohortRows = await PatientCohortModel.bulkCreate(patientCohortRows, {
    ignoreDuplicates: true,
  });
  createdPatientCohortRows.length;
  return;
}
