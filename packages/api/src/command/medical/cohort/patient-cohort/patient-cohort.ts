import { out } from "@metriport/core/util";
import { BadRequestError } from "@metriport/shared";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { Op } from "sequelize";
import { PatientCohortModel } from "../../../../models/medical/patient-cohort";
import { getPatientOrFail } from "../../patient/get-patient";
import { CohortWithPatientIdsAndCount, getCohortModelOrFail } from "../get-cohort";

type BulkRemovePatientsFromCohortParams = {
  cohortId: string;
  cxId: string;
  patientIds?: string[];
  all?: boolean;
};

type BulkAssignPatientsToCohortParams = {
  cohortId: string;
  cxId: string;
  patientIds: string[];
};

export async function getPatientIdsAssignedToCohort({
  cohortId,
  cxId,
}: {
  cohortId: string;
  cxId: string;
}): Promise<string[]> {
  const res = await PatientCohortModel.findAll({
    where: { cohortId },
    include: [
      {
        association: PatientCohortModel.associations.Cohort,
        where: { cxId },
        attributes: [],
        required: true,
      },
    ],
    attributes: ["patientId"],
  });
  return res.map(r => r.dataValues.patientId);
}

export async function getCountOfPatientsAssignedToCohort({
  cohortId,
  cxId,
}: {
  cohortId: string;
  cxId: string;
}): Promise<number> {
  return PatientCohortModel.count({
    where: { cohortId },
    include: [
      {
        association: PatientCohortModel.associations.Cohort,
        where: { cxId },
        attributes: [],
        required: true,
      },
    ],
  });
}

export async function bulkAssignPatientsToCohort({
  cohortId,
  cxId,
  patientIds,
}: BulkAssignPatientsToCohortParams): Promise<CohortWithPatientIdsAndCount> {
  const { log } = out(`bulkAssignPatientsToCohort - cx ${cxId}, cohort ${cohortId}`);

  const uniquePatientIds = [...new Set(patientIds)];
  if (!uniquePatientIds.length) {
    const cohort = await getCohortModelOrFail({ id: cohortId, cxId });
    return {
      cohort: cohort.dataValues,
      count: 0,
      patientIds: [],
    };
  }

  const cohort = await getCohortModelOrFail({ id: cohortId, cxId });

  const patientValidationResults = await Promise.allSettled(
    uniquePatientIds.map(patientId => getPatientOrFail({ id: patientId, cxId }))
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

  const assignments = uniquePatientIds.map(patientId => ({ id: uuidv7(), patientId, cohortId }));
  const createdAssignments = await PatientCohortModel.bulkCreate(assignments, {
    ignoreDuplicates: true,
  });

  const successCount = createdAssignments.length;
  log(`Assigned ${successCount}/${uniquePatientIds.length} patients to cohort ${cohortId}`);

  const totalAssignedPatientIds = await getPatientIdsAssignedToCohort({ cohortId, cxId });
  return {
    cohort: cohort.dataValues,
    count: totalAssignedPatientIds.length,
    patientIds: totalAssignedPatientIds,
  };
}

export async function bulkRemovePatientsFromCohort({
  cohortId,
  cxId,
  patientIds,
  all,
}: BulkRemovePatientsFromCohortParams): Promise<number> {
  const { log } = out(`bulkRemovePatientsFromCohort - cx ${cxId}, cohort ${cohortId}`);

  if ((!patientIds || patientIds.length < 1) && !all) {
    throw new BadRequestError("Either patientIds or all must be provided");
  }

  await getCohortModelOrFail({ id: cohortId, cxId });

  const whereClause = all ? { cohortId } : { cohortId, patientId: { [Op.in]: patientIds } };

  const deletedCount = await PatientCohortModel.destroy({ where: whereClause });
  log(`Removed ${deletedCount} patients from cohort ${cohortId}`);

  return deletedCount;
}
