import { Transaction } from "sequelize";
import { PatientCohortModel } from "../../../../models/medical/patient-cohort";

export type GetCohortSizeParams = {
  cohortId: string;
  transaction?: Transaction;
};

/**
 * @param cohortId - The ID of the cohort to get the size of.
 * @returns The size of the cohort.
 */
export async function getCohortSize({
  cohortId,
  transaction,
}: GetCohortSizeParams): Promise<number> {
  const count = await PatientCohortModel.count({
    where: { cohortId },
    include: [
      {
        association: PatientCohortModel.associations.Cohort,
        attributes: [],
        required: true,
      },
    ],
    transaction,
  });
  return count;
}
