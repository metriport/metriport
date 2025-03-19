import { AdtSubscriberData } from "@metriport/core/domain/patient-settings";
import { capture } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import { errorToString } from "@metriport/shared";
import { Sequelize } from "sequelize";
import { PatientModel } from "../../../models/medical/patient";
import { PatientSettingsModel } from "../../../models/patient-settings";

export async function getAdtSubscribers(targetStates: string[]): Promise<AdtSubscriberData[]> {
  const { log } = out(`Get ADT Subscribers`);
  log(`States: ${targetStates}`);
  const stateList = targetStates.map(s => `'${s}'`).join(", ");

  try {
    const patients = await PatientModel.findAll({
      where: Sequelize.literal(`
        EXISTS (
          SELECT 1
          FROM jsonb_array_elements(data->'address') addr
          WHERE addr->>'state' = ANY(ARRAY[${stateList}])
        )
      `),
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
           WHERE addr->>'state' = ANY(ARRAY[${stateList}]))
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
    });

    log(`Done. Found ${patients.length} ADT subscribers`);

    const adtSubscribersData = patients as unknown as AdtSubscriberData[];
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
