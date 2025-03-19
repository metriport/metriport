import {
  PatientSettings,
  PatientSettingsCreate,
  PatientSettingsData,
} from "@metriport/core/domain/patient-settings";
import { out } from "@metriport/core/util/log";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { BadRequestError } from "@metriport/shared";
import { Op } from "sequelize";
import { PatientModel } from "../../../../models/medical/patient";
import { PatientSettingsModel } from "../../../../models/patient-settings";
import { getPaginationItems } from "../../../pagination";
import { getPatientOrFail, getPatients, getPatientsCount } from "../get-patient";

type PatientSettingsUpsertResults = {
  patientsNotFound?: string[];
  patientsFoundAndUpdated: number;
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
  error?: Error;
};

const BATCH_SIZE = 1000;

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
 * Processes a batch of patient settings updates
 */
async function processBatch({
  patients,
  cxId,
  settings,
}: {
  patients: string[];
  cxId: string;
  settings: PatientSettingsData;
}): Promise<BatchProcessingResult> {
  try {
    const processedCount = await upsertPatientSettings({
      patientIds: patients,
      cxId,
      settings,
    });
    return { processedCount, failedCount: 0 };
  } catch (error) {
    return { processedCount: 0, failedCount: patients.length, error: error as Error };
  }
}

/**
 * Upserts patient settings for the given customer with specific patient IDs.
 * Processes patients in batches to handle large datasets efficiently.
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

  const totalPatients = await getPatientsCount({ cxId, facilityId });
  if (totalPatients === 0) {
    log(`No patients found for cx ${cxId}`);
    return { patientsFoundAndUpdated: 0 };
  }

  let processedTotal = 0;
  let failedTotal = 0;
  let fromItem: string | undefined;

  do {
    const { currPageItems, nextPageItemId } = await getPaginationItems(
      { count: BATCH_SIZE, ...(fromItem ? { fromItem } : {}) },
      pagination => getPatients({ cxId, facilityId, pagination }),
      () => Promise.resolve(totalPatients)
    );

    if (currPageItems.length === 0) break;

    const patientIds = currPageItems.map(p => p.id);
    const { processedCount, failedCount, error } = await processBatch({
      patients: patientIds,
      cxId,
      settings,
    });

    processedTotal += processedCount;
    failedTotal += failedCount;
    fromItem = nextPageItemId;

    log(
      `Processed batch: ${processedCount} successful, ` +
        `${failedCount} failed. Total progress: ${processedTotal}/${totalPatients}`
    );

    if (error) {
      log(`Error processing batch: ${error.message}`);
    }
  } while (fromItem);

  log(
    `Completed processing all patients. ` +
      `Total: ${processedTotal} successful, ${failedTotal} failed`
  );
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
