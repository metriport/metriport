import { Cohort } from "@metriport/core/domain/cohort";
import { NotFoundError } from "@metriport/shared";
import { col, fn, Op, Transaction } from "sequelize";
import { CohortModel } from "../../../models/medical/cohort";

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
}: GetCohortProps): Promise<CohortWithCount> {
  const cohortWithCount = await CohortModel.findOne({
    where: { cxId, id },
    attributes: {
      include: [[fn("COUNT", col("PatientCohort.id")), countAttr]],
    },
    include: [
      {
        association: CohortModel.associations.PatientCohort,
        attributes: [],
      },
    ],
    group: [col("CohortModel.id")],
  });
  if (!cohortWithCount) {
    throw new NotFoundError(`Could not find cohort`, undefined, { id, cxId });
  }

  return {
    cohort: cohortWithCount.dataValues,
    // Type assertion needed because Sequelize's get() method returns any for computed attributes
    count: Number((cohortWithCount.get(countAttr) as number | null) ?? 0),
  };
}

export async function getCohortsWithCount({ cxId }: { cxId: string }): Promise<CohortWithCount[]> {
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

export async function getCohortByName({
  cxId,
  name,
}: {
  cxId: string;
  name: string;
}): Promise<Cohort | undefined> {
  const trimmedName = name.trim();

  const cohort = await CohortModel.findOne({
    where: {
      cxId,
      name: {
        [Op.iLike]: trimmedName,
      },
    },
  });
  return cohort?.dataValues ?? undefined;
}
