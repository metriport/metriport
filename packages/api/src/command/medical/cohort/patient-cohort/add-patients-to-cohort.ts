import { out } from "@metriport/core/util";
import { NotFoundError } from "@metriport/shared";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { PatientCohortModel } from "../../../../models/medical/patient-cohort";
import { getPatientIds } from "../../patient/get-patient-read-only";
import { verifyPatients } from "../../patient/settings/common";
import { getCohortModelOrFail } from "../get-cohort";

type AddPatientsToCohortCmd = {
  cohortId: string;
  cxId: string;
  patientIds: string[];
};

export async function addPatientsToCohort({
  cohortId,
  cxId,
  patientIds,
}: AddPatientsToCohortCmd): Promise<void> {
  const { log } = out(`addPatientsToCohort - cx ${cxId}, cohort ${cohortId}`);

  if (patientIds.length < 1) return;

  await getCohortModelOrFail({ cohortId, cxId });

  const uniquePatientIds = [...new Set(patientIds)];
  const { validPatientIds, invalidPatientIds } = await verifyPatients({
    patientIds: uniquePatientIds,
    cxId,
  });

  if (invalidPatientIds.length > 0) {
    throw new NotFoundError(`One or more patient IDs were not found`, undefined, {
      cohortId,
      invalidPatientCount: invalidPatientIds.length,
    });
  }

  const patientCohortRows = validPatientIds.map(patientId => ({
    id: uuidv7(),
    patientId,
    cohortId,
  }));

  const createdPatientCohortRows = await PatientCohortModel.bulkCreate(patientCohortRows, {
    ignoreDuplicates: true,
  });

  log(`Assigned ${createdPatientCohortRows.length}/${uniquePatientIds.length} patients to cohort`);
}

type AssignAllPatientsToCohortParams = {
  cohortId: string;
  cxId: string;
};

export async function addAllPatientsToCohort({
  cohortId,
  cxId,
}: AssignAllPatientsToCohortParams): Promise<void> {
  const { log } = out(`addAllPatientsToCohort - cx ${cxId}, cohort ${cohortId}`);

  await getCohortModelOrFail({ cohortId, cxId });

  const patientIds = await getPatientIds({ cxId });

  const patientCohortRows = patientIds.map(patientId => ({
    id: uuidv7(),
    patientId,
    cohortId,
  }));

  const createdPatientCohortRows = await PatientCohortModel.bulkCreate(patientCohortRows, {
    ignoreDuplicates: true,
  });

  log(`Assigned ${createdPatientCohortRows.length}/${patientIds.length} patients to cohort`);
}
