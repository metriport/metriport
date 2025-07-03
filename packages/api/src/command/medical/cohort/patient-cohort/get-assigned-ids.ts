import { Transaction } from "sequelize";
import { PatientCohortModel } from "../../../../models/medical/patient-cohort";
import {
  Pagination,
  getPaginationFilters,
  getPaginationLimits,
  getPaginationSorting,
} from "../../../pagination";

export type GetPatientIdsAssignedToCohortParams = {
  cohortId: string;
  cxId: string;
  transaction?: Transaction;
};

export type GetPatientIdsAssignedToCohortPaginatedParams = {
  cohortId: string;
  cxId: string;
  pagination?: Pagination;
  transaction?: Transaction;
};

type PatientIdWithId = { id: string };

/**
 * @see executeOnDBTx() for details about the 'transaction' parameter.
 */
export async function getPatientIdsAssignedToCohort({
  cohortId,
  cxId,
  transaction,
}: GetPatientIdsAssignedToCohortParams): Promise<string[]> {
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
    transaction,
  });
  return res.map(r => r.dataValues.patientId);
}

/**
 * Get patient IDs assigned to a cohort with pagination support.
 * Returns objects with id properties to match pagination function requirements.
 *
 * @see executeOnDBTx() for details about the 'transaction' parameter.
 */
export async function getPatientIdsAssignedToCohortPaginated({
  cohortId,
  cxId,
  pagination,
  transaction,
}: GetPatientIdsAssignedToCohortPaginatedParams): Promise<PatientIdWithId[]> {
  const res = await PatientCohortModel.findAll({
    where: {
      cohortId,
      ...getPaginationFilters(pagination),
    },
    include: [
      {
        association: PatientCohortModel.associations.Cohort,
        where: { cxId },
        attributes: [],
        required: true,
      },
    ],
    attributes: ["patientId"],
    transaction,
    ...getPaginationLimits(pagination),
    order: [getPaginationSorting(pagination)],
  });

  return res.map(r => ({ id: r.dataValues.patientId }));
}
