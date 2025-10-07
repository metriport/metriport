import { executeAsynchronously } from "@metriport/core/util";
import { NotFoundError } from "@metriport/shared";
import { Cohort, CohortWithSize, normalizeCohortName } from "@metriport/shared/domain/cohort";
import { CohortModel } from "../../../models/medical/cohort";
import { getCohortSize } from "./patient-cohort/get-cohort-size";
import { normalizeCohortName } from "@metriport/core/command/patient-import/csv/convert-patient";

const COHORT_SIZE_LOOKUP_CONCURRENCY = 10;

export type GetCohortProps = {
  id: string;
  cxId: string;
};

export async function getCohortModelOrFail({ id, cxId }: GetCohortProps): Promise<CohortModel> {
  const cohort = await CohortModel.findOne({
    where: { id, cxId },
  });

  if (!cohort) throw new NotFoundError(`Could not find cohort`, undefined, { id });
  return cohort;
}

export async function getCohortWithSizeOrFail({
  id,
  cxId,
}: GetCohortProps): Promise<CohortWithSize> {
  const [cohort, size] = await Promise.all([
    getCohortModelOrFail({ id, cxId }),
    getCohortSize({ cohortId: id }),
  ]);

  return { ...cohort.dataValues, size };
}

export async function getCohorts({ cxId }: { cxId: string }): Promise<CohortWithSize[]> {
  const cohorts = await CohortModel.findAll({
    where: { cxId },
  });

  const cohortsWithSizes: CohortWithSize[] = [];
  await executeAsynchronously(
    cohorts,
    async cohort => {
      const size = await getCohortSize({ cohortId: cohort.id });
      cohortsWithSizes.push({
        ...cohort.dataValues,
        size,
      });
    },
    {
      numberOfParallelExecutions: COHORT_SIZE_LOOKUP_CONCURRENCY,
    }
  );

  return cohortsWithSizes;
}

export async function getCohortsForPatient({
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

  const cohortsWithSizes: CohortWithSize[] = [];
  await executeAsynchronously(cohorts, async cohort => {
    const size = await getCohortSize({ cohortId: cohort.id });
    cohortsWithSizes.push({
      ...cohort.dataValues,
      size,
    });
  });

  return cohortsWithSizes;
}

/**
 * Returns the cohort with the specified name.
 * @param cxId The ID of the CX.
 * @param name The name of the cohort.
 * @returns The cohort with the specified name.
 */
export async function getCohortByName({
  cxId,
  name,
}: {
  cxId: string;
  name: string;
}): Promise<Cohort> {
  const normalizedName = normalizeCohortName(name);

  const cohort = await CohortModel.findOne({
    where: { cxId, name: normalizedName },
  });

  if (!cohort) {
    throw new NotFoundError("No cohort found with the specified name", undefined, {
      cxId,
      name: normalizedName,
    });
  }

  return cohort.dataValues;
}

/**
 * Returns the cohort with the specified name, or undefined if not found or multiple found.
 * @param cxId The ID of the CX.
 * @param name The name of the cohort.
 * @returns The cohort with the specified name, or undefined if not found or multiple cohorts exist.
 */
export async function getCohortByNameSafe({
  cxId,
  name,
}: {
  cxId: string;
  name: string;
}): Promise<Cohort | undefined> {
  const normalizedName = normalizeCohortName(name);

  const cohorts = await CohortModel.findAll({
    where: {
      cxId,
      name: normalizedName,
    },
  });

  if (cohorts.length !== 1) {
    return undefined;
  }

  return cohorts[0].dataValues;
}
