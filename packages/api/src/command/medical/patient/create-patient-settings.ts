import {
  PatientSettings,
  PatientSettingsCreate,
  Subscriptions,
} from "@metriport/core/domain/patient-settings";
import { out } from "@metriport/core/util/log";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { BadRequestError } from "@metriport/shared";
import { PatientModel } from "../../../models/medical/patient";
import { PatientSettingsModel } from "../../../models/patient-settings";
import { getPatientIds, getPatientOrFail } from "./get-patient";

type PatientSettingsUpsertResults = {
  patientsNotFound?: string[];
  patientsFoundAndUpdated: number;
};

type PatientSettingsUpsertForCxProps = {
  cxId: string;
  subscribeTo: Subscriptions;
};

type PatientSettingsUpsertProps = PatientSettingsUpsertForCxProps & {
  patientIds: string[];
};

/**
 * Creates a new patient settings record.
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
 * Upserts patient settings for the given customer and patient IDs.
 *
 * @param cxId The customer ID
 * @param patientIds The patient IDs to upsert patient settings for.
 * @param subscribeTo The subscriptions to enable or disable.
 * @returns The number of patients updated and the list of patients not found
 */
export async function upsertPatientSettingsForPatientList({
  cxId,
  patientIds,
  subscribeTo = { adt: false },
}: PatientSettingsUpsertProps): Promise<PatientSettingsUpsertResults> {
  const { log } = out(`createOrUpdatePatientSettings - cx ${cxId}`);

  const { validPatientIds, invalidPatientIds: patientsNotFound } = await verifyPatients({
    patientIds,
    cxId,
  });

  if (validPatientIds.length === 0) {
    throw new BadRequestError(`No valid patients found`);
  }

  const patientsFoundAndUpdated = await upsertPatientSettings({
    patientIds: validPatientIds,
    cxId,
    subscribeTo,
  });

  log(`Updated settings for ${patientsFoundAndUpdated} patients`);
  return { patientsFoundAndUpdated, patientsNotFound };
}

/**
 * Upserts patient settings for the given customer with specific patient IDs.
 *
 * @param cxId The customer ID
 * @param subscribeTo The subscriptions to enable or disable.
 * @returns The number of patients updated and the list of patients not found
 */
export async function upsertPatientSettingsForCx({
  cxId,
  subscribeTo = { adt: false },
}: PatientSettingsUpsertForCxProps): Promise<PatientSettingsUpsertResults> {
  const { log } = out(`bulkUpsertPatientSettingsForCx - cx ${cxId}`);

  const patientIds = await getPatientIds({ cxId });

  if (!patientIds.length) {
    log(`No patients found for cx ${cxId}`);
    return { patientsFoundAndUpdated: 0 };
  }

  const patientsFoundAndUpdated = await upsertPatientSettings({
    patientIds,
    cxId,
    subscribeTo,
  });

  log(`Upserted settings for all CX patients. Total: ${patientsFoundAndUpdated}`);
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
