import { out } from "@metriport/core/util";
import { BadRequestError } from "@metriport/shared";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { validate as validateUuid } from "uuid";
import { PatientCohortModel } from "../../../../models/medical/patient-cohort";
import { strictlyValidateAllAndPatientIds } from "../../../../routes/medical/schemas/shared";
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
  // This validation ensures this command does not require special handling of patientIds vs isAssignAll
  strictlyValidateAllAndPatientIds({ patientIds, all: isAssignAll });
  const isValidCohortId = validateUuid(cohortId);
  if (!isValidCohortId) {
    throw new BadRequestError(`Cohort ID is not a valid UUID`, undefined, { cohortId });
  }

  const { log } = out(`bulkAssignPatientsToCohort - cx ${cxId}, cohort ${cohortId}`);
  const uniquePatientIds = [...new Set(patientIds)];

  const cohort = await getCohortModelOrFail({ id: cohortId, cxId });
  // If patient IDs is empty, we will get all patients for the cx
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
    count: totalAssignedPatientIds.length,
    patientIds: totalAssignedPatientIds,
  };
}
