import { BadRequestError, NotFoundError } from "@metriport/shared";
import { Cohort } from "@metriport/shared/domain/cohort";
import { CohortModel } from "../../../models/medical/cohort";
import { getCohortSize } from "./patient-cohort/get-cohort-size";

export type CohortWithDetails = { cohort: Cohort; details: { size: number } };

export type GetCohortProps = {
  id: string;
  cxId: string;
};

export async function getCohortOrFail({ id, cxId }: GetCohortProps): Promise<CohortModel> {
  const cohort = await CohortModel.findOne({
    where: { id, cxId },
  });

  if (!cohort) throw new NotFoundError(`Could not find cohort`, undefined, { id, cxId });
  return cohort;
}

export async function getCohortWithDetailsOrFail({
  id,
  cxId,
}: GetCohortProps): Promise<CohortWithDetails> {
  const [cohort, size] = await Promise.all([
    getCohortOrFail({ id, cxId }),
    getCohortSize({ cohortId: id, cxId }),
  ]);
  if (!cohort) throw new NotFoundError(`Could not find cohort`, undefined, { id, cxId });

  return { cohort: cohort.dataValues, details: { size } };
}

export async function getCohorts({ cxId }: { cxId: string }): Promise<Cohort[]> {
  const cohorts = await CohortModel.findAll({
    where: { cxId },
  });

  return cohorts.map(_ => _.dataValues);
}

export async function getCohortsForPatient({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<Cohort[]> {
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

  return cohorts.map(_ => _.dataValues);
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
  const trimmedName = name.trim();

  const cohorts = await CohortModel.findAll({
    where: {
      cxId,
      name: trimmedName,
    },
  });

  if (cohorts.length === 0) {
    throw new NotFoundError("No cohorts found with the specified name", undefined, {
      cxId,
      name: trimmedName,
    });
  } else if (cohorts.length > 1) {
    throw new BadRequestError("Multiple cohorts found with the specified name", undefined, {
      cxId,
      name: trimmedName,
    });
  }

  return cohorts[0].dataValues;
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
  const trimmedName = name.trim();

  const cohorts = await CohortModel.findAll({
    where: {
      cxId,
      name: trimmedName,
    },
  });

  if (cohorts.length !== 1) {
    return undefined;
  }

  return cohorts[0].dataValues;
}
