import { Transaction } from "sequelize";
import { PatientCohortModel } from "../../../../models/medical/patient-cohort";
import { getCohortModelOrFail } from "../get-cohort";

type GetCohortSizeCmd = {
  cohortId: string;
  cxId: string;
  transaction?: Transaction;
};

/**
 * @param cohortId - The ID of the cohort to get the size of.
 * @returns The size of the cohort.
 */
export async function getCohortSize({
  cohortId,
  cxId,
  transaction,
}: GetCohortSizeCmd): Promise<number> {
  await getCohortModelOrFail({ cohortId, cxId });

  const size = await PatientCohortModel.count({
    where: { cohortId },
    transaction,
  });
  return size;
}
