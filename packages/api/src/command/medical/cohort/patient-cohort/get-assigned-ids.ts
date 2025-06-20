import { Transaction } from "sequelize";
import { PatientCohortModel } from "../../../../models/medical/patient-cohort";

export type GetPatientIdsAssignedToCohortParams = {
  cohortId: string;
  cxId: string;
} & (
  | {
      transaction?: never;
    }
  | {
      /**
       * @see executeOnDBTx() for details about the 'transaction' parameter.
       */
      transaction: Transaction;
    }
);

/**
 * @see executeOnDBTx() for details about the 'transaction' parameter.
 */
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
