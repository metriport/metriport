import { Patient } from "@metriport/core/domain/patient";
import { capture } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import { MetriportError, errorToString } from "@metriport/shared";
import { FindOptions, Op, Order, Sequelize, WhereOptions } from "sequelize";
import { PatientModelReadOnly } from "../../../models/medical/patient-readonly";
import { PatientSettingsModel } from "../../../models/patient-settings";
import { Pagination, getPaginationFilters, getPaginationLimits } from "../../pagination";

export type GetHl7v2SubscribersParams = {
  hieName: string;
  pagination?: Pagination;
};

function getCommonQueryOptions({
  hieName,
  pagination,
}: Omit<GetHl7v2SubscribersParams, "hieName"> & { hieName: string }) {
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
              AND ps.subscriptions->'adt' IS NOT NULL
              AND ps.subscriptions->'adt' ? :hieName
          )
          `),
      ],
    } as WhereOptions,
    replacements: { hieName },
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

export async function getHl7v2Subscribers({
  hieName,
  pagination,
}: GetHl7v2SubscribersParams): Promise<Patient[]> {
  const { log } = out(`Get HL7v2 subscribers`);
  log(`HIE: ${hieName}, pagination params: ${JSON.stringify(pagination)}`);

  try {
    const findOptions: FindOptions<PatientModelReadOnly> = {
      ...getCommonQueryOptions({ hieName, pagination }),
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
        hieName,
      },
    });
    throw new MetriportError(msg, error, { hieName });
  }
}
