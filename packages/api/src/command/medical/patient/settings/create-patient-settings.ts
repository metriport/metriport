import {
  PatientSettings,
  PatientSettingsCreate,
  PatientSettingsData,
} from "@metriport/core/domain/patient-settings";
import { capture } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { BadRequestError, errorToString } from "@metriport/shared";
import { chunk } from "lodash";
import { Op } from "sequelize";
import { PatientModel } from "../../../../models/medical/patient";
import { PatientSettingsModel } from "../../../../models/patient-settings";
import { getPatientIds, getPatientOrFail } from "../get-patient";

type PatientSettingsUpsertResults = {
  patientsNotFound?: string[];
  patientsFoundAndUpdated: number;
  failedCount?: number;
  failedIds?: string[];
};

type PatientSettingsUpsertForCxProps = {
  cxId: string;
  facilityId?: string;
  settings: PatientSettingsData;
};

type PatientSettingsUpsertProps = PatientSettingsUpsertForCxProps & {
  patientIds: string[];
};

type BatchProcessingResult = {
  processedCount: number;
  failedCount: number;
  failedIds?: string[];
};

const BATCH_SIZE = 500;

/**
 * Maximum number of retries for a batch operation
 */
const MAX_BATCH_RETRIES = 3;

/**
 * Creates a new patient settings record.
 *
 * @param patientId The patient ID
 * @param cxId The customer ID
 * @param settings Patient settings object, which includes subscriptions
 * @returns The created patient settings record
 */
export async function createPatientSettings({
  patientId,
  cxId,
  subscriptions,
}: Omit<PatientSettingsCreate, "id">): Promise<PatientSettings> {
  await getPatientOrFail({ cxId, id: patientId });

  const patientSettingsCreate: PatientSettingsCreate = {
    id: uuidv7(),
    cxId,
    patientId,
    subscriptions,
  };

  const newPatientSettings = await PatientSettingsModel.create(patientSettingsCreate);
  return newPatientSettings.dataValues;
}

/**
 * Upserts patient settings for the given customer and patient IDs.
 *
 * @param cxId The customer ID
 * @param facilityId The facility ID. Optional.
 * @param patientIds The patient IDs to upsert patient settings for.
 * @param settings Patient settings object, which includes subscriptions
 * @returns The number of patients updated and the list of patients not found
 */
export async function upsertPatientSettingsForPatientList({
  cxId,
  facilityId,
  patientIds,
  settings,
}: PatientSettingsUpsertProps): Promise<PatientSettingsUpsertResults> {
  const { log } = out(`upsertPatientSettingsForPatientList - cx ${cxId}`);

  const { validPatientIds, invalidPatientIds: patientsNotFound } = await verifyPatients({
    cxId,
    facilityId,
    patientIds,
  });

  if (validPatientIds.length === 0) {
    throw new BadRequestError(`No valid patients found`);
  }

  const patientsFoundAndUpdated = await upsertPatientSettings({
    cxId,
    patientIds: validPatientIds,
    settings,
  });

  log(`Updated settings for ${patientsFoundAndUpdated} patients`);
  return { patientsFoundAndUpdated, patientsNotFound };
}

/**
 * Processes a batch of patient settings upserts with retries
 */
async function processBatch({
  patientIds,
  cxId,
  settings,
  log,
}: {
  patientIds: string[];
  cxId: string;
  settings: PatientSettingsData;
  log: typeof console.log;
}): Promise<BatchProcessingResult> {
  for (let attempt = 1; attempt <= MAX_BATCH_RETRIES; attempt++) {
    try {
      const processedCount = await upsertPatientSettings({
        patientIds,
        cxId,
        settings,
      });
      return { processedCount, failedCount: 0 };
    } catch (error) {
      const isLastAttempt = attempt >= MAX_BATCH_RETRIES;

      if (!isLastAttempt) {
        log(
          `Batch operation failed, attempt ${attempt}/${MAX_BATCH_RETRIES}: ${errorToString(error)}`
        );
      } else {
        log(`Batch operation failed, will not try again: ${errorToString(error)}`);
      }
    }
  }

  return {
    processedCount: 0,
    failedCount: patientIds.length,
    failedIds: patientIds,
  };
}

/**
 * Upserts patient settings for the given customer with specific patient IDs.
 * Processes patient settings updates in batches to handle large datasets efficiently.
 *
 * @param cxId The customer ID
 * @param facilityId The facility ID. Optional.
 * @param settings Patient settings object, which includes subscriptions
 * @returns The number of patients updated and the list of patients not found
 */
export async function upsertPatientSettingsForCx({
  cxId,
  facilityId,
  settings,
}: PatientSettingsUpsertForCxProps): Promise<PatientSettingsUpsertResults> {
  const { log } = out(`upsertPatientSettingsForCx - cx ${cxId}`);

  const patientIds = await getPatientIds({ cxId, facilityId });
  if (patientIds.length === 0) {
    log(`No patients found for cx ${cxId}`);
    return { patientsFoundAndUpdated: 0 };
  }

  let processedTotal = 0;
  let failedTotal = 0;
  const failedIds: string[] = [];

  const batches = chunk(patientIds, BATCH_SIZE);
  for (const batchIds of batches) {
    const {
      processedCount,
      failedCount,
      failedIds: failedBatchIds,
    } = await processBatch({
      patientIds: batchIds,
      cxId,
      settings,
      log,
    });

    processedTotal += processedCount;
    failedTotal += failedCount;
    failedIds.push(...(failedBatchIds ?? []));
  }

  log(
    `Completed processing all patients. ` +
      `Total: ${processedTotal} successful, ${failedTotal} failed`
  );

  if (failedTotal > 0) {
    const msg = `Failed to upsert settings for patients`;
    log(`${msg} - failed IDs: ${JSON.stringify(failedIds)}`);
    capture.error(msg, {
      extra: {
        cxId,
        facilityId,
        failedIds,
      },
    });
    return { patientsFoundAndUpdated: processedTotal, failedCount: failedTotal, failedIds };
  }

  return { patientsFoundAndUpdated: processedTotal };
}

async function verifyPatients({
  patientIds,
  facilityId,
  cxId,
}: {
  patientIds: string[];
  facilityId?: string;
  cxId: string;
}): Promise<{
  validPatientIds: string[];
  invalidPatientIds: string[];
}> {
  if (patientIds.length < 1) {
    return {
      validPatientIds: [],
      invalidPatientIds: [],
    };
  }

  const patients = await PatientModel.findAll({
    where: {
      id: patientIds,
      cxId,
      ...(facilityId && {
        facilityIds: { [Op.contains]: [facilityId] },
      }),
    },
    attributes: ["id"],
  });
  const foundPatientIds = new Set(patients.map(p => p.id));
  const invalidPatientIds = patientIds.filter(id => !foundPatientIds.has(id));
  return {
    validPatientIds: Array.from(foundPatientIds),
    invalidPatientIds,
  };
}

async function upsertPatientSettings({
  patientIds,
  cxId,
  settings,
}: {
  patientIds: string[];
  cxId: string;
  settings: PatientSettingsData;
}): Promise<number> {
  const existingSettings = await PatientSettingsModel.findAll({
    where: { patientId: patientIds, cxId },
  });
  const existingSettingsMap = new Map(existingSettings.map(s => [s.patientId, s]));

  const upserts = patientIds.map(patientId => ({
    id: existingSettingsMap.get(patientId)?.id ?? uuidv7(),
    cxId,
    patientId,
    subscriptions: {
      ...existingSettingsMap.get(patientId)?.subscriptions,
      ...settings.subscriptions,
    },
  }));

  await PatientSettingsModel.bulkCreate(upserts, {
    returning: false,
    updateOnDuplicate: ["subscriptions"],
  });

  return upserts.length;
}
