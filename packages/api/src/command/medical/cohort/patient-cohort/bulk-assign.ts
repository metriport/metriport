import { out } from "@metriport/core/util";
import { BadRequestError } from "@metriport/shared";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { PatientCohortModel } from "../../../../models/medical/patient-cohort";
import { getPatientOrFail } from "../../patient/get-patient";
import { getPatientIds } from "../../patient/get-patient-read-only";
import { CohortWithPatientIdsAndCount, getCohortModelOrFail } from "../get-cohort";
import { getPatientIdsAssignedToCohort } from "./get-assigned-ids";

type BulkAssignPatientsToCohortParams = {
  cohortId: string;
  cxId: string;
  patientIds?: string[];
  isAssignAll?: boolean;
};

export async function bulkAssignPatientsToCohort({
  cohortId,
  cxId,
  patientIds,
  isAssignAll,
}: BulkAssignPatientsToCohortParams): Promise<CohortWithPatientIdsAndCount> {
  const { log } = out(`bulkAssignPatientsToCohort - cx ${cxId}, cohort ${cohortId}`);

  let patientIdsToAssignToCohort = [...new Set(patientIds)];

  const cohort = await getCohortModelOrFail({ id: cohortId, cxId });

  if (isAssignAll) {
    patientIdsToAssignToCohort = await getPatientIds({ cxId });
  }

  const patientValidationResults = await Promise.allSettled(
    patientIdsToAssignToCohort.map(patientId => getPatientOrFail({ id: patientId, cxId }))
  );

  const invalidPatientIds = patientValidationResults
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .flatMap(result => result.reason.additionalInfo?.id ?? []);

  if (invalidPatientIds.length > 0) {
    log(`Found ${invalidPatientIds.length} invalid patients`);
    throw new BadRequestError(`Some patient IDs do not exist`, undefined, {
      invalidPatientIds: JSON.stringify(invalidPatientIds),
    });
  }

  const assignments = patientIdsToAssignToCohort.map(patientId => ({
    id: uuidv7(),
    patientId,
    cohortId,
  }));

  const createdAssignments = await PatientCohortModel.bulkCreate(assignments, {
    ignoreDuplicates: true,
  });

  const successCount = createdAssignments.length;
  log(
    `Assigned ${successCount}/${patientIdsToAssignToCohort.length} patients to cohort ${cohortId}`
  );

  const totalAssignedPatientIds = await getPatientIdsAssignedToCohort({
    cohortId,
    cxId,
  });

  return {
    cohort: cohort.dataValues,
    count: totalAssignedPatientIds.length,
    patientIds: totalAssignedPatientIds,
  };
}
