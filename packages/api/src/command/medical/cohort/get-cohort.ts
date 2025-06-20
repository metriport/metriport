import { Cohort } from "@metriport/core/domain/cohort";
import { NotFoundError } from "@metriport/shared";
import { col, fn, Transaction } from "sequelize";
import { CohortModel } from "../../../models/medical/cohort";
import { getPatientIdsAssignedToCohort } from "./patient-cohort/get-assigned-ids";

const countAttr = "count";

export type CohortWithCount = { cohort: Cohort; count: number };
export type CohortWithPatientIdsAndCount = CohortWithCount & { patientIds: string[] };

export type GetCohortProps = {
  id: string;
  cxId: string;
} & (
  | {
      transaction?: never;
      lock?: never;
    }
  | {
      /**
       * @see executeOnDBTx() for details about the 'transaction' parameter.
       */
      transaction: Transaction;
      /**
       * @see executeOnDBTx() for details about the 'lock' parameter.
       */
      lock?: boolean;
    }
);

/**
 * @see executeOnDBTx() for details about the 'transaction' and 'lock' parameters.
 */
export async function getCohortModelOrFail({
  id,
  cxId,
  transaction,
  lock,
}: GetCohortProps): Promise<CohortModel> {
  const cohort = await CohortModel.findOne({
    where: { id, cxId },
    transaction,
    lock,
  });

  if (!cohort) throw new NotFoundError(`Could not find cohort`, undefined, { id, cxId });
  return cohort;
}

export async function getCohortWithCountOrFail({
  id,
  cxId,
}: GetCohortProps): Promise<CohortWithPatientIdsAndCount> {
  const [cohort, patientIds] = await Promise.all([
    getCohortModelOrFail({ id, cxId }),
    getPatientIdsAssignedToCohort({ cohortId: id, cxId }),
  ]);
  if (!cohort) throw new NotFoundError(`Could not find cohort`, undefined, { id, cxId });

  return { cohort: cohort.dataValues, count: patientIds.length, patientIds };
}

export async function getCohorts({ cxId }: { cxId: string }): Promise<CohortWithCount[]> {
  const cohortsWithCounts = await CohortModel.findAll({
    where: { cxId },
    include: [
      {
        association: CohortModel.associations.PatientCohort,
        attributes: [],
        required: false,
      },
    ],
    attributes: {
      include: [[fn("COUNT", col("PatientCohort.id")), countAttr]],
    },
    group: [col("CohortModel.id")],
  });

  return cohortsWithCounts.map(cohort => ({
    cohort: cohort.dataValues,
    // Type assertion needed because Sequelize's get() method returns any for computed attributes
    count: Number((cohort.get(countAttr) as number | null) ?? 0),
  }));
}
