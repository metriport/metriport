import { Patient } from "@metriport/core/domain/patient";
import { capture } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import { MetriportError, errorToString } from "@metriport/shared";
import { FindOptions, Op, Order, Sequelize, WhereOptions } from "sequelize";
import { PatientModelReadOnly } from "../../../models/medical/patient-readonly";
import { PatientSettingsModel } from "../../../models/patient-settings";
import { Pagination, getPaginationFilters, getPaginationLimits } from "../../pagination";

export type GetQuestRosterParams = {
  pagination?: Pagination;
};

function getCommonQueryOptions({ pagination }: GetQuestRosterParams) {
  const order: Order = [["id", "DESC"]];

  return {
    where: {
      ...(pagination ? getPaginationFilters(pagination) : {}),
      [Op.and]: [
        Sequelize.literal(`
          EXISTS (
              SELECT 1
              FROM patient_settings ps
              WHERE ps.patient_id = "PatientModelReadOnly"."id"
              AND ps.subscriptions->'quest' = 'true'
          )
          `),
      ],
    } as WhereOptions,
    include: [
      {
        model: PatientSettingsModel,
        attributes: [],
        required: true,
      },
    ],
    ...(pagination ? getPaginationLimits(pagination) : {}),
    ...(pagination ? { order } : {}),
  };
}

export async function getQuestRoster({ pagination }: GetQuestRosterParams): Promise<Patient[]> {
  const { log } = out(`Quest roster`);
  log(`Pagination params: ${JSON.stringify(pagination)}`);

  try {
    const findOptions: FindOptions<PatientModelReadOnly> = {
      ...getCommonQueryOptions({ pagination }),
    };

    const patients = await PatientModelReadOnly.findAll(findOptions);

    log(`Done. Found ${patients.length} Quest monitoring patients for this page`);
    return patients;
  } catch (error) {
    const msg = `Failed to get Quest monitoring patients`;
    log(`${msg} - err: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        error,
      },
    });
    throw new MetriportError(msg, error);
  }
}
