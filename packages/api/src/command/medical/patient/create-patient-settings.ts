import {
  PatientSettings,
  PatientSettingsCreate,
  Subscriptions,
} from "@metriport/core/domain/patient-settings";
import { out } from "@metriport/core/util/log";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { PatientModel } from "../../../models/medical/patient";
import { PatientSettingsModel } from "../../../models/patient-settings";
import { getPatientIds, getPatientOrFail } from "./get-patient";

/**
 * Creates a new patient settings record
 *
 * @param patientId The patient ID
 * @param cxId The customer ID
 * @param adtSubscription Whether to enable or disable ADT subscription. Optional, defaults to false.
 * @returns The created patient settings record
 */
export async function createPatientSettings({
  patientId,
  cxId,
  subscribeTo = { adt: false },
}: Omit<PatientSettingsCreate, "id">): Promise<PatientSettings> {
  await getPatientOrFail({ cxId, id: patientId });

  const patientSettingsCreate: PatientSettingsCreate = {
    id: uuidv7(),
    cxId,
    patientId,
    subscribeTo,
  };

  const newPatientSettings = await PatientSettingsModel.create(patientSettingsCreate);
  return newPatientSettings.dataValues;
}

/**
 * Upserts patient settings for the given customer and patient IDs
 *
 * @param cxId The customer ID
 * @param patientIds The patient IDs to update. Optional. If not provided, all patients for the CX will be updated.
 * @param adtSubscription Whether to enable or disable ADT subscription. Optional, defaults to false.
 * @returns The number of patients updated and the list of patients not found
 */
export async function bulkUpsertPatientSettings({
  cxId,
  patientIds,
  subscribeTo = { adt: false },
}: {
  cxId: string;
  patientIds: string[];
  subscribeTo: Subscriptions;
}): Promise<{
  patientsNotFound?: string[];
  patientsFoundAndUpdated: number;
}> {
  const { log } = out(`createOrUpdatePatientSettings - cx ${cxId}`);

  const idsToProcess = patientIds.length > 0 ? patientIds : await getPatientIds({ cxId });

  if (!idsToProcess.length) {
    log(`No patients found for cx ${cxId}`);
    return { patientsNotFound: [], patientsFoundAndUpdated: 0 };
  }

  let finalIds = idsToProcess;

  // Only verify patients if specific IDs were provided
  if (patientIds.length > 0) {
    const { validPatientIds, invalidPatientIds: patientsNotFound } = await verifyPatients({
      patientIds: idsToProcess,
      cxId,
    });
    if (validPatientIds.length === 0) {
      log(`No valid patients found`);
      return { patientsNotFound, patientsFoundAndUpdated: 0 };
    }
    finalIds = validPatientIds;
  }

  const patientsFoundAndUpdated = await upsertPatientSettings({
    patientIds: finalIds,
    cxId,
    subscribeTo,
  });

  log(`Updated settings for ${patientsFoundAndUpdated} patients`);
  return { patientsFoundAndUpdated };
}

async function verifyPatients({
  patientIds,
  cxId,
}: {
  patientIds: string[];
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
    where: { id: patientIds, cxId },
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
  subscribeTo,
}: {
  patientIds: string[];
  cxId: string;
  subscribeTo: Subscriptions;
}): Promise<number> {
  const existingSettings = await PatientSettingsModel.findAll({
    where: { patientId: patientIds, cxId },
  });
  const existingSettingsMap = new Map(existingSettings.map(s => [s.patientId, s]));

  const upserts = patientIds.map(patientId => ({
    id: existingSettingsMap.get(patientId)?.id ?? uuidv7(),
    cxId,
    patientId,
    subscribeTo,
  }));

  await PatientSettingsModel.bulkCreate(upserts, {
    updateOnDuplicate: ["subscribeTo"],
  });

  return upserts.length;
}
