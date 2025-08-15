import { Patient } from "@metriport/core/domain/patient";
import { capture, executeAsynchronously } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
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
              AND ps.subscriptions->'quest' IS NOT NULL
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

    await executeAsynchronously(
      patients,
      async patient => {
        patient.externalId = await findOrCreateQuestExternalId(patient, log);
      },
      {
        numberOfParallelExecutions: 10,
      }
    );

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

async function findOrCreateQuestExternalId(
  patient: Patient,
  log: ReturnType<typeof out>["log"]
): Promise<string> {
  const mapping = await findFirstPatientMappingForSource({
    patientId: patient.id,
    source: questSource,
  });
  if (mapping) {
    log(`Found Quest mapping: ${patient.id} <-> ${mapping.externalId}`);
    return mapping.externalId;
  }

  let retryWithNewExternalId = false;

  do {
    const externalId = buildQuestExternalId();
    try {
      const created = await createPatientMapping({
        cxId: patient.cxId,
        patientId: patient.id,
        externalId,
        source: questSource,
      });
      log(`Created Quest mapping: ${patient.id} <-> ${created.externalId}`);
      return created.externalId;
    } catch (error) {
      // If the ID was already generated, retry with a new external ID
      if (error instanceof UniqueConstraintError && !retryWithNewExternalId) {
        retryWithNewExternalId = true;
      } else {
        throw error;
      }
    }
  } while (retryWithNewExternalId);

  // It is extremely improbable to not find a unique ID in two tries. Even if there was a
  // Quest ID for every human on earth, the chance of this error is one in 4 billion.
  throw new MetriportError(`Failed to create Quest external ID`);
}
