import { Patient } from "@metriport/core/domain/patient";
import { capture, executeAsynchronously } from "@metriport/core/util";
import { out, LogFunction } from "@metriport/core/util/log";
import { MetriportError, errorToString } from "@metriport/shared";
import { questSource } from "@metriport/shared/interface/external/quest/source";
import { buildQuestExternalId } from "@metriport/core/external/quest/id-generator";
import { FindOptions, Op, Order, Sequelize, UniqueConstraintError, WhereOptions } from "sequelize";
import {
  findFirstPatientMappingForSource,
  createPatientMapping,
} from "../../../command/mapping/patient";
import { PatientModelReadOnly } from "../../../models/medical/patient-readonly";
import { PatientSettingsModel } from "../../../models/patient-settings";
import { Pagination, getPaginationFilters, getPaginationLimits } from "../../pagination";

export type GetQuestRosterParams = {
  pagination?: Pagination;
};

const MAX_ATTEMPTS_TO_CREATE_EXTERNAL_ID = 2;
const EXTERNAL_ID_LOOKUP_CONCURRENCY = 10;

function getCommonQueryOptions({ pagination }: GetQuestRosterParams) {
  const order: Order = [["id", "DESC"]];

  return {
    where: {
      ...(pagination ? getPaginationFilters(pagination) : {}),
      [Op.and]: [
        Sequelize.literal(`
          EXISTS (
            SELECT 1
            FROM patient_cohort pc
            JOIN cohort ch ON ch.id = pc.cohort_id
            WHERE pc.patient_id = "PatientModelReadOnly"."id"
              AND jsonb_typeof(ch.settings->'monitoring'->'laboratory'->'notifications') = 'boolean'
              AND (ch.settings->'monitoring'->'laboratory'->>'notifications')::boolean IS TRUE
          )
        `),
      ],
    } satisfies WhereOptions,
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

    const patientResults = await PatientModelReadOnly.findAll(findOptions);
    log(`Done. Found ${patientResults.length} Quest monitoring patients for this page`);

    const patientsWithQuestId: Patient[] = [];
    const patientsWithError: Patient[] = [];
    await executeAsynchronously(
      patientResults,
      async patientResult => {
        const patient = patientResult.dataValues;
        try {
          const externalId = await findOrCreateQuestExternalId(patient, log);
          patientsWithQuestId.push({ ...patient, externalId });
        } catch (error) {
          patientsWithError.push(patient);
        }
      },
      {
        numberOfParallelExecutions: EXTERNAL_ID_LOOKUP_CONCURRENCY,
      }
    );

    log(
      `Generated Quest roster with ${patientsWithQuestId.length} patients and ${patientsWithError.length} errors`
    );
    return patientsWithQuestId;
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

async function findOrCreateQuestExternalId(
  patient: Patient,
  log: LogFunction,
  attempt = 1
): Promise<string> {
  const mapping = await findFirstPatientMappingForSource({
    patientId: patient.id,
    source: questSource,
  });
  if (mapping) {
    log(`Found Quest mapping: ${patient.id} <-> ${mapping.externalId}`);
    return mapping.externalId;
  }

  const externalId = buildQuestExternalId();
  try {
    const created = await createPatientMapping({
      cxId: patient.cxId,
      patientId: patient.id,
      externalId,
      source: questSource,
      secondaryMappings: {},
    });
    log(`Created Quest mapping: ${patient.id} <-> ${created.externalId}`);
    return created.externalId;
  } catch (error) {
    // Handles the very improbable case where there is an ID collision
    if (error instanceof UniqueConstraintError && attempt < MAX_ATTEMPTS_TO_CREATE_EXTERNAL_ID) {
      return findOrCreateQuestExternalId(patient, log, attempt + 1);
    }
    throw error;
  }
}
