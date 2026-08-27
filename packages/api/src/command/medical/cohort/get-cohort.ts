import { executeAsynchronously } from "@metriport/core/util";
import { NotFoundError } from "@metriport/shared";
import {
  Cohort,
  CohortWithSize,
  normalizeCohortName,
  Overrides,
} from "@metriport/shared/domain/cohort";
import { CohortModel } from "../../../models/medical/cohort";
import { getCohortSize } from "./patient-cohort/get-cohort-size";
import { getAvailableOverrides } from "../patient/get-settings";

const NUMBER_OF_PARALLEL_EXECUTIONS = 10;

export type GetCohortCmd = {
  cohortId: string;
  cxId: string;
};

export async function getCohortModelOrFail({ cohortId, cxId }: GetCohortCmd): Promise<CohortModel> {
  const cohort = await CohortModel.findOne({
    where: { id: cohortId, cxId },
  });

  if (!cohort) throw new NotFoundError(`Could not find cohort`, undefined, { cohortId });
  return cohort;
}

export async function getCohortWithSize({ cohortId, cxId }: GetCohortCmd): Promise<CohortWithSize> {
  const [cohort, size] = await Promise.all([
    getCohortModelOrFail({ cohortId, cxId }),
    getCohortSize({ cohortId, cxId }),
  ]);

  return { ...cohort.dataValues, eTag: cohort.eTag, size };
}

export async function listCohortsWithSizes({ cxId }: { cxId: string }): Promise<CohortWithSize[]> {
  const cohorts = await CohortModel.findAll({
    where: { cxId },
  });

  const cohortsWithSizes = await getSizesForCohorts(cohorts, cxId);

  return cohortsWithSizes;
}

export async function listCohortsWithSizesForPatient({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<CohortWithSize[]> {
  const cohorts = await CohortModel.findAll({
    where: { cxId },
    include: [
      {
        association: CohortModel.associations.PatientCohort,
        where: { patientId },
        attributes: [],
        required: true,
      },
    ],
  });

  const cohortsWithSizes = await getSizesForCohorts(cohorts, cxId);

  return cohortsWithSizes;
}

/**
 * Returns the cohort with the specified name.
 * @param cxId The ID of the CX.
 * @param name The name of the cohort.
 * @returns The cohort with the specified name.
 */
export async function getCohortByNameOrFail({
  cxId,
  name,
}: {
  cxId: string;
  name: string;
}): Promise<Cohort> {
  const normalizedName = normalizeCohortName(name);

  const cohort = await getCohortByName({ cxId, name: normalizedName });

  if (!cohort) {
    throw new NotFoundError("No cohort found with the specified name", undefined, {
      cxId,
      name: normalizedName,
    });
  }

  return cohort;
}

/**
 * Returns the cohort with the specified name, or undefined if not found.
 * @param cxId The ID of the CX.
 * @param name The name of the cohort.
 * @returns The cohort with the specified name, or undefined if not found.
 */
export async function getCohortByName({
  cxId,
  name,
}: {
  cxId: string;
  name: string;
}): Promise<Cohort | undefined> {
  const normalizedName = normalizeCohortName(name);

  const cohort = await CohortModel.findOne({
    where: {
      cxId,
      name: normalizedName,
    },
  });

  return cohort ? { ...cohort.dataValues, eTag: cohort.eTag } : undefined;
}

async function getSizesForCohorts(cohorts: CohortModel[], cxId: string): Promise<CohortWithSize[]> {
  const cohortsWithSizes: CohortWithSize[] = [];
  await executeAsynchronously(
    cohorts,
    async cohort => {
      const size = await getCohortSize({ cohortId: cohort.dataValues.id, cxId });
      cohortsWithSizes.push({
        ...cohort.dataValues,
        eTag: cohort.eTag,
        size,
      });
    },
    { numberOfParallelExecutions: NUMBER_OF_PARALLEL_EXECUTIONS }
  );
  return cohortsWithSizes;
}

export async function getAllOverridesForCohort({
  cohortId,
  cxId,
}: {
  cohortId: string;
  cxId: string;
}): Promise<Overrides> {
  const allAvailableOverrides = getAvailableOverrides();
  const cohort = await getCohortModelOrFail({ cohortId, cxId });
  const defaultOverrides = Object.fromEntries(
    allAvailableOverrides.map(override => [override, false])
  );
  const fullOverrides: Overrides = { ...defaultOverrides, ...cohort.settings.overrides };
  return fullOverrides;
}
