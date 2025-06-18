import {
  PatientCohort,
  PatientCohortCreate,
  PatientCohortData,
} from "@metriport/core/domain/cohort";
import { out } from "@metriport/core/util";
import { BadRequestError } from "@metriport/shared";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { Op } from "sequelize";
import { PatientCohortModel } from "../../../../models/medical/patient-cohort";
import { getPatientOrFail } from "../../patient/get-patient";
import { getCohortModelOrFail } from "../get-cohort";

type BulkRemovePatientsFromCohortParams = {
  cohortId: string;
  cxId: string;
  data: {
    patientIds?: string[];
    all?: boolean;
  };
};

type BulkAssignPatientsToCohortParams = {
  cohortId: string;
  cxId: string;
  patientIds: string[];
};

export async function assignCohort({
  patientId,
  cohortId,
  cxId,
}: PatientCohortCreate): Promise<PatientCohort> {
  const [, , existing] = await Promise.all([
    getCohortModelOrFail({ id: cohortId, cxId }),
    getPatientOrFail({ id: patientId, cxId }),
    getCohortAssignment({ patientId, cohortId }),
  ]);

  if (existing) return existing;
  return PatientCohortModel.create({ id: uuidv7(), patientId, cohortId });
}

export async function unassignCohort({
  patientId,
  cohortId,
  cxId,
}: PatientCohortCreate): Promise<void> {
  await Promise.all([
    getCohortModelOrFail({ id: cohortId, cxId }),
    getPatientOrFail({ id: patientId, cxId }),
  ]);

  await PatientCohortModel.destroy({ where: { patientId, cohortId } });
}

export async function getCohortAssignment({
  patientId,
  cohortId,
}: PatientCohortData): Promise<PatientCohort | undefined> {
  const res = await PatientCohortModel.findOne({ where: { patientId, cohortId } });
  return res?.dataValues;
}

export async function getPatientsAssignedToCohort({
  cohortId,
}: {
  cohortId: string;
}): Promise<string[]> {
  const res = await PatientCohortModel.findAll({
    where: { cohortId },
    attributes: ["patientId"],
  });
  return res.map(r => r.dataValues.patientId);
}

export async function getCountOfPatientsAssignedToCohort({
  cohortId,
}: {
  cohortId: string;
}): Promise<number> {
  return PatientCohortModel.count({ where: { cohortId } });
}

export async function bulkAssignPatientsToCohort({
  cohortId,
  cxId,
  patientIds,
}: BulkAssignPatientsToCohortParams): Promise<number> {
  const { log } = out(`bulkAssignPatientsToCohort - cx ${cxId}, cohort ${cohortId}`);

  if (!patientIds.length) {
    throw new BadRequestError("No patient IDs provided");
  }

  await getCohortModelOrFail({ id: cohortId, cxId });

  const patientValidationResults = await Promise.allSettled(
    patientIds.map(patientId => getPatientOrFail({ id: patientId, cxId }))
  );

  const invalidPatientIds = patientValidationResults
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .flatMap(result => result.reason.additionalInfo?.id ?? []);

  if (invalidPatientIds.length > 0) {
    log(`Found ${invalidPatientIds.length} invalid patients`);
    throw new BadRequestError(
      `Some patients do not exist: [${invalidPatientIds.join(", ")}]`,
      undefined,
      {
        invalidPatientIds: JSON.stringify(invalidPatientIds),
      }
    );
  }

  const assignments = patientIds.map(patientId => ({ id: uuidv7(), patientId, cohortId }));
  const createdAssignments = await PatientCohortModel.bulkCreate(assignments, {
    ignoreDuplicates: true,
  });

  const successCount = createdAssignments.length;
  log(`Assigned ${successCount}/${patientIds.length} patients to cohort ${cohortId}`);

  return successCount;
}

export async function bulkRemovePatientsFromCohort({
  cohortId,
  cxId,
  data,
}: BulkRemovePatientsFromCohortParams): Promise<number> {
  const { log } = out(`bulkRemovePatientsFromCohort - cx ${cxId}, cohort ${cohortId}`);

  if (!data.patientIds && !data.all) {
    throw new BadRequestError("Either patientIds or all must be provided");
  }

  await getCohortModelOrFail({ id: cohortId, cxId });

  const whereClause = data.all
    ? { cohortId }
    : { cohortId, patientId: { [Op.in]: data.patientIds } };

  const deletedCount = await PatientCohortModel.destroy({ where: whereClause });
  log(`Removed ${deletedCount} patients from cohort ${cohortId}`);

  return deletedCount;
}
