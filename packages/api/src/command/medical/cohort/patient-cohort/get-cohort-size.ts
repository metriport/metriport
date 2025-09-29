import { Transaction } from "sequelize";
import { PatientCohortModel } from "../../../../models/medical/patient-cohort";

export type GetCohortSizeParams = {
  cohortId: string;
  cxId: string;
  transaction?: Transaction;
};

/**
 * @param cohortId - The ID of the cohort to get the size of.
 * @param cxId - The ID of the CX to get the size of.
 * @returns The size of the cohort.
 */
export async function getCohortSize({ cohortId, cxId }: GetCohortSizeParams): Promise<number> {
  const count = await PatientCohortModel.count({
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
  return count;
}
