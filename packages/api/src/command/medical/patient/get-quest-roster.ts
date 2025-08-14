import { Patient } from "@metriport/core/domain/patient";
import { capture } from "@metriport/core/util";
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

    for (const patient of patients) {
      patient.externalId = await findOrCreateQuestExternalId(patient, log);
    }

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

  // There is an extremely small chance of an ID collision, since the external ID
  // is limited to 15 characters. This allows up to one additional retry if the
  // uniqueness constraint on the external ID column is violated.
  let retryWithDifferentExternalId = false;

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
      // If the uniqueness constraint is violated, allow one additional retry.
      if (error instanceof UniqueConstraintError && !retryWithDifferentExternalId) {
        retryWithDifferentExternalId = true;
      } else {
        throw error;
      }
    }
  } while (retryWithDifferentExternalId);

  // After the second retry, throw an error.
  throw new MetriportError("Failed to create Quest mapping for patient", undefined, {
    patientId: patient.id,
  });
}
