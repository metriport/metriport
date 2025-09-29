import { Transaction } from "sequelize";
import { PatientCohortModel } from "../../../../models/medical/patient-cohort";

export type GetPatientCountInCohortParams = {
  cohortId: string;
  cxId: string;
  transaction?: Transaction;
};

/**
 * @see executeOnDBTx() for details about the 'transaction' parameter.
 */
export async function getCohortSize({
  cohortId,
  cxId,
  transaction,
}: GetPatientCountInCohortParams): Promise<number> {
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
    transaction,
  });
  return count;
}
