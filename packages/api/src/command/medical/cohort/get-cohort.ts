import { Cohort, CohortEntity } from "@metriport/shared/domain/cohort";
import { NotFoundError } from "@metriport/shared";
import { col, fn, Op, Transaction } from "sequelize";
import { CohortModel } from "../../../models/medical/cohort";
import { getPatientIdsAssignedToCohort } from "./patient-cohort/get-assigned-ids";

const countAttr = "count";

export type CohortEntityWithSize = { cohort: CohortEntity; size: number };
export type CohortEntityWithPatientIdsAndCount = CohortEntityWithSize & { patientIds: string[] };

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

export async function getCohortWithSizeOrFail({
  id,
  cxId,
}: GetCohortProps): Promise<CohortEntityWithPatientIdsAndCount> {
  const [cohort, patientIds] = await Promise.all([
    getCohortModelOrFail({ id, cxId }),
    getPatientIdsAssignedToCohort({ cohortId: id, cxId }),
  ]);
  if (!cohort) throw new NotFoundError(`Could not find cohort`, undefined, { id, cxId });

  return { cohort: cohort.dataValues, size: patientIds.length, patientIds };
}

export async function getCohorts({ cxId }: { cxId: string }): Promise<CohortEntityWithSize[]> {
  const cohortsWithSize = await CohortModel.findAll({
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

  return cohortsWithSize.map(cohort => ({
    cohort: cohort.dataValues,
    // Type assertion needed because Sequelize's get() method returns any for computed attributes
    size: Number((cohort.get(countAttr) as number | null) ?? 0),
  }));
}

export async function getCohortsForPatient({
  cxId,
}: // patientId,
{
  cxId: string;
  // patientId: string;
}): Promise<CohortEntity[]> {
  const cohorts = await CohortModel.findAll({
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

  return cohorts.dataValues;
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
