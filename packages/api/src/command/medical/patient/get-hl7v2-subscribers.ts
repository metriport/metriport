import { Patient } from "@metriport/core/domain/patient";
import { capture } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import { MetriportError, errorToString } from "@metriport/shared";
import { FindOptions, Op, Order, Sequelize, WhereOptions } from "sequelize";
import { PatientModelReadOnly } from "../../../models/medical/patient-readonly";
import { Pagination, getPaginationFilters, getPaginationLimits } from "../../pagination";

export type GetHl7v2SubscribersParams = {
  hieStates: string[];
  pagination?: Pagination;
};

function getCommonQueryOptions({
  hieStates,
  pagination,
}: Omit<GetHl7v2SubscribersParams, "hieStates"> & { hieStates: string[] }) {
  const order: Order = [["id", "DESC"]];

  return {
    where: {
      ...(pagination ? getPaginationFilters(pagination) : {}),
      [Op.and]: [
        Sequelize.literal(`
          NOT EXISTS (
            SELECT 1
            FROM patient_cohort pc
            JOIN cohort ch ON pc.cohort_id = ch.id
            WHERE pc.patient_id = "PatientModelReadOnly".id
            AND (ch.settings->>'adtMonitoring' != 'true' OR ch.settings->>'adtMonitoring' IS NULL)
          )
          AND EXISTS (
            SELECT 1
            FROM patient_cohort pc
            JOIN cohort ch ON pc.cohort_id = ch.id
            WHERE pc.patient_id = "PatientModelReadOnly".id
            AND ch.settings->>'adtMonitoring' = 'true'
          )
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements("PatientModelReadOnly".data->'address') addr
            WHERE addr->>'state' = ANY(ARRAY[:hieStates])
          )
        `),
      ],
    } as WhereOptions,
    replacements: {
      hieStates,
    },
    ...(pagination ? getPaginationLimits(pagination) : {}),
    ...(pagination ? { order } : {}),
  };
}

export async function getHl7v2Subscribers({
  hieStates,
  pagination,
}: GetHl7v2SubscribersParams): Promise<Patient[]> {
  const { log } = out(`Get HL7v2 subscribers`);
  log(`HIE states: ${hieStates}, pagination params: ${JSON.stringify(pagination)}`);

  try {
    const findOptions: FindOptions<PatientModelReadOnly> = {
      ...getCommonQueryOptions({ hieStates, pagination }),
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
        hieStates,
      },
    });
    throw new MetriportError(msg, error, { hieStates: hieStates.join(",") });
  }
}
