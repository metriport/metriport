import { Hl7v2Subscription } from "@metriport/core/domain/patient-settings";
import { capture } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import { MetriportError, USState, errorToString } from "@metriport/shared";
import { FindOptions, Op, Order, Sequelize, WhereOptions } from "sequelize";
import { PatientModelReadOnly } from "../../../models/medical/patient-readonly";
import { Patient } from "@metriport/core/domain/patient";
import { PatientSettingsModel } from "../../../models/patient-settings";
import { Pagination, getPaginationFilters, getPaginationLimits } from "../../pagination";

export type GetHl7v2SubscribersParams = {
  states: USState[];
  subscriptions: Hl7v2Subscription[];
  pagination?: Pagination;
};

function getCommonQueryOptions({
  states,
  subscriptions,
  pagination,
}: Omit<GetHl7v2SubscribersParams, "states"> & { states: string }) {
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
    replacements: { states },
    include: [
      {
        model: PatientSettingsModel,
        where: {
          subscriptions: transformSubscriptionsToObject(subscriptions),
        },
        attributes: [],
        required: true,
      },
    ],
    ...(pagination ? getPaginationLimits(pagination) : {}),
    ...(pagination ? { order } : {}),
  };
}

export async function getHl7v2Subscribers({
  states,
  subscriptions,
  pagination,
}: GetHl7v2SubscribersParams): Promise<Patient[]> {
  const { log } = out(`Get HL7v2 subscribers`);
  log(`States: ${states}, pagination params: ${JSON.stringify(pagination)}`);
  const statesString = combineStatesIntoReplacementObject(states);

  try {
    const findOptions: FindOptions<PatientModelReadOnly> = {
      ...getCommonQueryOptions({ states: statesString, subscriptions, pagination }),
    };

    const patients = await PatientModelReadOnly.findAll(findOptions);

    log(`Done. Found ${patients.length} HL7v2 subscribers for this page`);
    return patients;
  } catch (error) {
    const msg = `Failed to get HL7v2 subscribers`;
    log(`${msg} - err: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        error,
        states: states,
      },
    });
    throw new MetriportError(msg, error, { states: states.toString() });
  }
}

function combineStatesIntoReplacementObject(states: USState[]): string {
  return `{${states.join(",")}}`;
}

function transformSubscriptionsToObject(
  subscriptions: Hl7v2Subscription[]
): Record<string, boolean> {
  return subscriptions.reduce((acc, subscription) => ({ ...acc, [subscription]: true }), {});
}
