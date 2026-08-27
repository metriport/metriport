import { capture } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import { MetriportError, USState, errorToString } from "@metriport/shared";
import { FindOptions, Op, Order, Sequelize, WhereOptions } from "sequelize";
import { PatientModelReadOnly } from "../../../models/medical/patient-readonly";
import { Pagination, getPaginationFilters, getPaginationLimits } from "../../pagination";
import { getExcludeHieNameString } from "@metriport/core/external/hl7-notification/hie-config-dictionary";
import { STATE_VALIDATION_OVERRIDE_KEY } from "@metriport/shared/domain/cohort";

export type GetHl7v2SubscribersParams = {
  hieName: string;
  hieStates: USState[];
  pagination?: Pagination;
};

function getCommonQueryOptions({ hieName, hieStates, pagination }: GetHl7v2SubscribersParams) {
  const order: Order = [["id", "DESC"]];
  const hieNameOverrideString = getExcludeHieNameString(hieName);
  return {
    where: {
      ...(pagination ? getPaginationFilters(pagination) : {}),
      [Op.and]: [
        Sequelize.literal(`
          EXISTS (
            SELECT 1
            FROM patient_cohort pc
            JOIN cohort ch ON pc.cohort_id = ch.id
            WHERE pc.patient_id = "PatientModelReadOnly".id
              AND COALESCE((ch.settings->'monitoring'->'adt'->>'enabled')::boolean, false) = true
              AND (ch.settings->'overrides'->>:hieNameOverrideString)::boolean = false
              AND (
                (ch.settings->'overrides'->>'${STATE_VALIDATION_OVERRIDE_KEY}')::boolean = false
                OR "PatientModelReadOnly".data->'address'->0->>'state' = ANY(ARRAY[:hieStates])
              )
          )
        `),
      ],
    } as WhereOptions,
    replacements: {
      hieStates,
      hieNameOverrideString,
    },
    ...(pagination ? getPaginationLimits(pagination) : {}),
    ...(pagination ? { order } : {}),
  };
}

export async function getHl7v2Subscribers({
  hieName,
  hieStates,
  pagination,
}: GetHl7v2SubscribersParams): Promise<PatientModelReadOnly[]> {
  const { log } = out(`Get HL7v2 subscribers`);
  log(
    `HIE name: ${hieName}, HIE states: ${hieStates}, pagination params: ${JSON.stringify(
      pagination
    )}`
  );

  try {
    const findOptions: FindOptions<PatientModelReadOnly> = {
      ...getCommonQueryOptions({ hieName, hieStates, pagination }),
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
