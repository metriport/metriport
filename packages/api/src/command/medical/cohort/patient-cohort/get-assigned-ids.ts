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
};

export type GetPatientIdsAssignedToCohortPaginatedParams = GetPatientIdsAssignedToCohortParams & {
  pagination: Pagination;
};

type PatientIdWithId = { id: string };

export async function getPatientIdsAssignedToCohort({
  cohortId,
  cxId,
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
  });
  return res.map(r => r.dataValues.patientId);
}

export async function getPatientIdsAssignedToCohortPaginated({
  cohortId,
  cxId,
  pagination,
}: GetPatientIdsAssignedToCohortPaginatedParams): Promise<PatientIdWithId[]> {
  const [, orderDirection] = getPaginationSorting(pagination);
  const patientIdFilter = getPaginationFilters(pagination).id;

  const res = await PatientCohortModel.findAll({
    where: {
      cohortId,
      ...(patientIdFilter ? { patientId: patientIdFilter } : undefined),
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
    order: [["patientId", orderDirection as string]],
    ...getPaginationLimits(pagination),
  });

  return res.map(r => ({ id: r.dataValues.patientId }));
}
