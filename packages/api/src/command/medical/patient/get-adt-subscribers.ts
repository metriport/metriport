import { AdtSubscriber } from "@metriport/core/domain/patient-settings";
import { capture } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import { USState, errorToString } from "@metriport/shared";
import { FindOptions, Op, Order, Sequelize, WhereOptions } from "sequelize";
import { PatientModelReadOnly } from "../../../models/medical/patient-readonly";
import { PatientSettingsModel } from "../../../models/patient-settings";
import { Pagination, getPaginationFilters, getPaginationLimits } from "../../pagination";

export type GetAdtSubscribersParams = {
  targetStates: string;
  pagination: Pagination;
};

export function combineStatesIntoReplacementObject(states: USState[]): string {
  return `{${states.join(",")}}`;
}

function getCommonQueryOptions(targetStates: string, pagination?: Pagination) {
  const order: Order = [["id", "DESC"]];
  return {
    where: {
      ...(pagination ? getPaginationFilters(pagination) : {}),
      [Op.and]: [
        Sequelize.literal(`
            EXISTS (
              SELECT 1
              FROM jsonb_array_elements(data->'address') addr
              WHERE addr->>'state' = ANY(:states)
            )
          `),
      ],
    } as WhereOptions,
    replacements: {
      states: targetStates,
    },
    include: [
      {
        model: PatientSettingsModel,
        where: {
          subscriptions: { adt: true },
        },
        attributes: [],
        required: true,
      },
    ],
    ...(pagination ? getPaginationLimits(pagination) : {}),
    ...(pagination ? { order } : {}),
  };
}

export async function getAdtSubscribers({
  targetStates,
  pagination,
}: GetAdtSubscribersParams): Promise<AdtSubscriber[]> {
  const { log } = out(`Get ADT Subscribers`);
  log(`States: ${targetStates}, pagination params: ${JSON.stringify(pagination)}`);

  try {
    const findOptions: FindOptions<PatientModelReadOnly> = {
      ...getCommonQueryOptions(targetStates, pagination),
      attributes: [
        "id",
        ["cx_id", "cxId"],
        [Sequelize.literal(`data->>'firstName'`), "firstName"],
        [Sequelize.literal(`data->>'lastName'`), "lastName"],
        [Sequelize.literal(`data->>'dob'`), "dob"],
        [
          Sequelize.literal(`
          (SELECT jsonb_agg(addr)
           FROM jsonb_array_elements(data->'address') addr
           WHERE addr->>'state' = ANY(:states))
        `),
          "address",
        ],
        [
          Sequelize.literal(`
          (SELECT value->>'value'
           FROM jsonb_array_elements(data->'personalIdentifiers') value
           WHERE value->>'type' = 'ssn'
           LIMIT 1)
          `),
          "ssn",
        ],
        [
          Sequelize.literal(`
          (SELECT value->>'value'
           FROM jsonb_array_elements(data->'personalIdentifiers') value
           WHERE value->>'type' = 'driversLicense'
           LIMIT 1)
          `),
          "driversLicense",
        ],
        [Sequelize.literal(`data->'contact'`), "contact"],
        [Sequelize.literal(`data->>'genderAtBirth'`), "genderAtBirth"],
      ],
    };

    const patients = await PatientModelReadOnly.findAll(findOptions);

    log(`Done. Found ${patients.length} ADT subscribers for this page`);

    const adtSubscribersData = patients as unknown as AdtSubscriber[];
    return adtSubscribersData;
  } catch (error) {
    const msg = `Failed to get ADT subscribers`;
    log(`${msg} - err: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        error,
        states: targetStates,
      },
    });
    throw new Error(msg, { cause: error });
  }
}

export async function getAdtSubscribersCount(targetStates: string): Promise<number> {
  const { log } = out(`Get ADT Subscribers Count`);
  log(`States: ${targetStates}`);

  try {
    const findOptions = {
      ...getCommonQueryOptions(targetStates),
      col: "id",
    };

    const count = await PatientModelReadOnly.count(findOptions);
    log(`Done. Total count: ${count}`);
    return count;
  } catch (error) {
    const msg = `Failed to get ADT subscribers count`;
    log(`${msg} - err: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        error,
        states: targetStates,
      },
    });
    throw new Error(msg, { cause: error });
  }
}
