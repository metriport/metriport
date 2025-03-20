import { AdtSubscriber } from "@metriport/core/domain/patient-settings";
import { capture } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import { USState, errorToString } from "@metriport/shared";
import { FindOptions, Op, QueryTypes, Sequelize, WhereOptions } from "sequelize";
import { PatientModel } from "../../../models/medical/patient";
import { PatientSettingsModel } from "../../../models/patient-settings";
import { Pagination, getPaginationFilters, getPaginationLimits } from "../../pagination";

export type GetAdtSubscribersParams = {
  targetStates: USState[];
  pagination: Pagination;
};

export async function getAdtSubscribers({
  targetStates,
  pagination,
}: GetAdtSubscribersParams): Promise<AdtSubscriber[]> {
  const { log } = out(`Get ADT Subscribers`);
  log(`States: ${targetStates}, pagination params: ${JSON.stringify(pagination)}`);

  try {
    const states = `{${targetStates.join(",")}}`;
    const findOptions: FindOptions<PatientModel> = {
      where: {
        ...getPaginationFilters(pagination),
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
        states,
      },
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
        [Sequelize.literal(`data->'personalIdentifiers'`), "personalIdentifiers"],
        [Sequelize.literal(`data->'contact'`), "contact"],
        [Sequelize.literal(`data->>'genderAtBirth'`), "genderAtBirth"],
      ],
      include: [
        {
          model: PatientSettingsModel,
          as: "settings",
          where: {
            subscriptions: { adt: true },
          },
          attributes: [],
          required: true,
        },
      ],
      ...getPaginationLimits(pagination),
      order: [["id", "DESC"]],
    };

    const patients = await PatientModel.findAll(findOptions);

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

export async function getAdtSubscribersCount(targetStates: USState[]): Promise<number> {
  const { log } = out(`Get ADT Subscribers Count`);
  log(`States: ${targetStates}`);

  try {
    const states = `{${targetStates.join(",")}}`;
    const sequelize = PatientModel.sequelize;
    if (!sequelize) throw new Error("Sequelize not found");

    const query = `
      SELECT COUNT(DISTINCT p.id) as count
      FROM patient p
      INNER JOIN patient_settings ps ON ps.patient_id = p.id
      WHERE ps.subscriptions->>'adt' = 'true'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p.data->'address') addr
        WHERE addr->>'state' = ANY(:states)
      )
    `;

    const result = await sequelize.query(query, {
      replacements: { states },
      type: QueryTypes.SELECT,
    });

    const count = parseInt((result[0] as { count: string }).count);
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
