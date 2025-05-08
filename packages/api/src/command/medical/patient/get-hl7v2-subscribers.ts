import { compressUuid } from "@metriport/core/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/shared";
import { Hl7v2Subscriber, Hl7v2Subscription } from "@metriport/core/domain/patient-settings";
import { capture } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import { MetriportError, USState, errorToString } from "@metriport/shared";
import { FindOptions, Op, Order, Sequelize, WhereOptions } from "sequelize";
import { PatientModelReadOnly } from "../../../models/medical/patient-readonly";
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
}: GetHl7v2SubscribersParams): Promise<Hl7v2Subscriber[]> {
  const { log } = out(`Get HL7v2 subscribers`);
  log(`States: ${states}, pagination params: ${JSON.stringify(pagination)}`);
  const statesString = combineStatesIntoReplacementObject(states);

  try {
    const findOptions: FindOptions<PatientModelReadOnly> = {
      ...getCommonQueryOptions({ states: statesString, subscriptions, pagination }),
    };

    const patients = await PatientModelReadOnly.findAll(findOptions);

    log(`Done. Found ${patients.length} HL7v2 subscribers for this page`);
    return mapPatientsToSubscribers(patients);
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

function mapPatientsToSubscribers(patients: PatientModelReadOnly[]): Hl7v2Subscriber[] {
  return patients.map(p => {
    const data = p.data;
    const ssn = data.personalIdentifiers?.find(id => id.type === "ssn")?.value;
    const driversLicense = data.personalIdentifiers?.find(
      id => id.type === "driversLicense"
    )?.value;
    const phone = data.contact?.find(c => c.phone)?.phone;
    const email = data.contact?.find(c => c.email)?.email;
    const compressedPatientId = compressUuid(p.id);
    const compressedCxId = compressUuid(p.cxId);
    const scrambledId = `${compressedCxId}_${compressedPatientId}`;

    return {
      id: p.id,
      cxId: p.cxId,
      scrambledId,
      lastName: data.lastName,
      firstName: data.firstName,
      dob: data.dob,
      genderAtBirth: data.genderAtBirth,
      address: data.address,
      ...(ssn ? { ssn } : undefined),
      ...(driversLicense ? { driversLicense } : undefined),
      ...(phone ? { phone } : undefined),
      ...(email ? { email } : undefined),
    };
  });
}
