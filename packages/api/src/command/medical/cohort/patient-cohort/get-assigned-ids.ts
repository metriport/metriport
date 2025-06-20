import { Transaction } from "sequelize";
import { PatientCohortModel } from "../../../../models/medical/patient-cohort";

export type GetPatientIdsAssignedToCohortParams = {
  cohortId: string;
  cxId: string;
  transaction?: Transaction;
};

/**
 * @see executeOnDBTx() for details about the 'transaction' parameter.
 */
export async function getPatientIdsAssignedToCohort({
  cohortId,
  cxId,
  transaction,
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
    transaction,
  });
  return res.map(r => r.dataValues.patientId);
}
