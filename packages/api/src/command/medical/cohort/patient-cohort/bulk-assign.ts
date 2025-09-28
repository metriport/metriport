import { out } from "@metriport/core/util";
import { BadRequestError } from "@metriport/shared";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { PatientCohortModel } from "../../../../models/medical/patient-cohort";
import { getPatientIds } from "../../patient/get-patient-read-only";
import { getCohortModelOrFail } from "../get-cohort";
import { getPatientIdsAssignedToCohort } from "./get-assigned-ids";

type BulkAssignPatientsToCohortParams = {
  cohortId: string;
  cxId: string;
  patientIds: string[];
};

export async function bulkAssignPatientsToCohort({
  cohortId,
  cxId,
  patientIds,
}: BulkAssignPatientsToCohortParams): Promise<CohortEntityWithPatientIdsAndCount> {
  const { log } = out(`bulkAssignPatientsToCohort - cx ${cxId}, cohort ${cohortId}`);

  if (patientIds.length === 0) {
    throw new BadRequestError(
      'No patient IDs provided in request. Use the "all" flag to assign all patients to the cohort.',
      undefined,
      { cxId, cohortId }
    );
  }

  const uniquePatientIds = [...new Set(patientIds)];

  const cohort = await getCohortModelOrFail({ id: cohortId, cxId });
  const validatedIds = await getPatientIds({ cxId, patientIds: uniquePatientIds });

  const assignments = validatedIds.map(patientId => ({
    id: uuidv7(),
    patientId,
    cohortId,
  }));

  const createdAssignments = await PatientCohortModel.bulkCreate(assignments, {
    ignoreDuplicates: true,
  });
  const successCount = createdAssignments.length;
  log(`Assigned ${successCount}/${validatedIds.length} patients to cohort ${cohortId}`);

  const totalAssignedPatientIds = await getPatientIdsAssignedToCohort({
    cohortId,
    cxId,
  });

  return {
    cohort: cohort.dataValues,
    size: totalAssignedPatientIds.length,
    patientIds: totalAssignedPatientIds,
  };
}

type AssignAllPatientsToCohortParams = {
  cohortId: string;
  cxId: string;
};

export async function assignAllPatientsToCohort({
  cohortId,
  cxId,
}: AssignAllPatientsToCohortParams): Promise<CohortEntityWithPatientIdsAndCount> {
  const { log } = out(`assignAllPatientsToCohort - cx ${cxId}, cohort ${cohortId}`);

  const cohort = await getCohortModelOrFail({ id: cohortId, cxId });
  const validatedIds = await getPatientIds({ cxId });

  const assignments = validatedIds.map(patientId => ({
    id: uuidv7(),
    patientId,
    cohortId,
  }));

  const createdAssignments = await PatientCohortModel.bulkCreate(assignments, {
    ignoreDuplicates: true,
  });
  const successCount = createdAssignments.length;
  log(`Assigned ${successCount}/${validatedIds.length} patients to cohort ${cohortId}`);

  const totalAssignedPatientIds = await getPatientIdsAssignedToCohort({
    cohortId,
    cxId,
  });

  return {
    cohort: cohort.dataValues,
    size: totalAssignedPatientIds.length,
    patientIds: totalAssignedPatientIds,
  };
}
