import {
  PatientSettings,
  PatientSettingsCreate,
  PatientSettingsData,
} from "@metriport/core/domain/patient-settings";
import { out } from "@metriport/core/util/log";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { BadRequestError } from "@metriport/shared";
import { PatientSettingsModel } from "../../../../models/patient-settings";
import { getPatientOrFail } from "../get-patient";
import { getPatientIds } from "../get-patient-read-only";
import { processPatientsInBatches } from "./batch-utils";
import {
  CustomerProcessingResult,
  PatientListProcessingResult,
  PatientSettingsUpsertForCxProps,
  PatientSettingsUpsertProps,
  upsertPatientSettings,
  verifyPatients,
} from "./common";

// Re-export types for backward compatibility
export type {
  CustomerProcessingResult,
  PatientListProcessingResult,
  PatientSettingsUpsertForCxProps,
  PatientSettingsUpsertProps,
} from "./common";

export {
  addHieSubscriptionToPatients,
  removeHieSubscriptionFromPatients,
} from "./hie-subscriptions";

/**
 * Creates a new patient settings record.
 *
 * @param patientId The patient ID
 * @param cxId The customer ID
 * @param subscriptions Patient settings subscriptions
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
}: PatientSettingsUpsertProps): Promise<PatientListProcessingResult> {
  const { log } = out(`upsertPatientSettingsForPatientList - cx ${cxId}`);

  const { validPatientIds, invalidPatientIds: patientsNotFound } = await verifyPatients({
    cxId,
    facilityId,
    patientIds,
  });

  if (validPatientIds.length === 0) {
    throw new BadRequestError(`No valid patients found`);
  }

  async function batchProcessor(batch: string[]): Promise<void> {
    await upsertPatientSettings({
      patientIds: batch,
      cxId,
      settings,
    });
  }

  await processPatientsInBatches(validPatientIds, batchProcessor, {
    cxId,
    facilityId,
    operationName: "upsertPatientSettingsForCx",
    errorMessage: "Failed to upsert settings for patients",
    throwOnNoPatients: false,
  });

  log(`Updated settings for ${validPatientIds.length} patients`);
  return {
    patientsFoundAndUpdated: validPatientIds.length,
    patientsNotFound: patientsNotFound || [],
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
}: PatientSettingsUpsertForCxProps): Promise<CustomerProcessingResult> {
  const patientIds = await getPatientIds({ cxId, facilityId });

  async function batchProcessor(batch: string[]): Promise<void> {
    await upsertPatientSettings({
      patientIds: batch,
      cxId,
      settings,
    });
  }

  return await processPatientsInBatches(patientIds, batchProcessor, {
    cxId,
    facilityId,
    operationName: "upsertPatientSettingsForCx",
    errorMessage: "Failed to upsert settings for patients",
    throwOnNoPatients: false,
  });
}

async function upsertPatientSettings({
  patientIds,
  cxId,
  settings,
}: {
  patientIds: string[];
  cxId: string;
  settings: PatientSettingsData;
}): Promise<void> {
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
}
