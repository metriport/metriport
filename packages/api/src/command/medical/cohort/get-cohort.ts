import { Cohort } from "@metriport/core/domain/cohort";
import { NotFoundError } from "@metriport/shared";
import { CohortModel } from "../../../models/medical/cohort";
import {
  getCountOfPatientsAssignedToCohort,
  getPatientsAssignedToCohort,
} from "./cohort-assignment/assign-cohort";

type CohortWithCount = { cohort: Cohort; count: number };
type CohortWithPatientIdsAndCount = CohortWithCount & { patientIds: string[] };

export type GetCohortProps = {
  id: string;
  cxId: string;
};

export async function getCohortModelOrFail({ id, cxId }: GetCohortProps): Promise<CohortModel> {
  const cohort = await CohortModel.findOne({
    where: { id, cxId },
  });

  if (!cohort) throw new NotFoundError(`Could not find cohort`, undefined, { id, cxId });
  return cohort;
}

export async function getCohortWithCountOrFail({
  id,
  cxId,
}: GetCohortProps): Promise<CohortWithPatientIdsAndCount> {
  const cohort = await CohortModel.findOne({
    where: { id, cxId },
  });

  const patientIds = await getPatientsAssignedToCohort({ cohortId: id });
  if (!cohort) throw new NotFoundError(`Could not find cohort`, undefined, { id, cxId });

  return { cohort: cohort.dataValues, count: patientIds.length, patientIds };
}

export async function getCohortWithPatientIdsOrFail({
  id,
  cxId,
}: GetCohortProps): Promise<CohortWithCount> {
  const cohort = await CohortModel.findOne({
    where: { id, cxId },
  });

  const count = await getCountOfPatientsAssignedToCohort({ cohortId: id });
  if (!cohort) throw new NotFoundError(`Could not find cohort`, undefined, { id, cxId });

  return { cohort: cohort.dataValues, count };
}

export async function getCohorts({ cxId }: { cxId: string }): Promise<CohortWithCount[]> {
  const cohorts = await CohortModel.findAll({
    where: { cxId },
  });

  return Promise.all(
    cohorts.map(async cohort => ({
      cohort: cohort.dataValues,
      count: await getCountOfPatientsAssignedToCohort({ cohortId: cohort.id }),
    }))
  );
}
