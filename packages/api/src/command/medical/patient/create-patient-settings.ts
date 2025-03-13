import { PatientSettings, PatientSettingsCreate } from "@metriport/core/domain/patient-settings";
import { out } from "@metriport/core/util/log";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { Transaction } from "sequelize";
import { PatientModel } from "../../../models/medical/patient";
import { PatientSettingsModel } from "../../../models/patient-settings";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
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
  adtSubscription,
}: {
  patientId: string;
  cxId: string;
  adtSubscription: boolean;
}): Promise<PatientSettings> {
  await getPatientOrFail({ cxId, id: patientId });

  const patientSettingsCreate: PatientSettingsCreate = {
    id: uuidv7(),
    cxId,
    patientId,
    adtSubscription,
  };

  const newPatientSettings = await PatientSettingsModel.create(patientSettingsCreate);
  return newPatientSettings;
}

/**
 * Creates or updates patient settings for the given customer and patient IDs
 *
 * @param cxId The customer ID
 * @param patientIds The patient IDs to update. Optional. If not provided, all patients for the CX will be updated.
 * @param adtSubscription Whether to enable or disable ADT subscription. Optional, defaults to false.
 * @returns The number of patients updated and the list of patients not found
 */
export async function createOrUpdatePatientSettings({
  cxId,
  patientIds = [],
  adtSubscription = false,
}: {
  cxId: string;
  patientIds?: string[];
  adtSubscription?: boolean;
}): Promise<{
  patientsNotFound: string[];
  patientsUpdated: number;
}> {
  const { log } = out(`createOrUpdatePatientSettings - cx ${cxId}`);

  const idsToProcess = Array.isArray(patientIds) ? patientIds : [];
  let finalIds = idsToProcess.length > 0 ? idsToProcess : await getPatientIds({ cxId });

  if (!finalIds.length) {
    log(`No patients found for cx ${cxId}`);
    return { patientsNotFound: [], patientsUpdated: 0 };
  }

  let patientsNotFound: string[] = [];
  let patientsUpdated = 0;

  await executeOnDBTx(PatientModel.prototype, async transaction => {
    // Only verify patients if specific IDs were provided
    if (idsToProcess.length > 0) {
      const { validPatientIds, notFoundIds } = await verifyPatients({
        patientIds: finalIds,
        cxId,
        transaction,
      });
      patientsNotFound = notFoundIds;
      if (validPatientIds.length === 0) {
        log(`No valid patients found`);
        return;
      }
      finalIds = validPatientIds;
    }

    patientsUpdated = await upsertPatientSettings({
      patientIds: finalIds,
      cxId,
      adtSubscription,
      transaction,
    });

    log(`Updated settings for ${patientsUpdated} patients`);
  });

  return { patientsNotFound, patientsUpdated };
}

async function verifyPatients({
  patientIds,
  cxId,
  transaction,
}: {
  patientIds: string[];
  cxId: string;
  transaction: Transaction;
}): Promise<{
  validPatientIds: string[];
  notFoundIds: string[];
}> {
  const patients = await PatientModel.findAll({
    where: { id: patientIds, cxId },
    attributes: ["id"],
    transaction,
  });
  const foundPatientIds = new Set(patients.map(p => p.id));
  const notFoundIds = patientIds.filter(id => !foundPatientIds.has(id));
  return {
    validPatientIds: Array.from(foundPatientIds),
    notFoundIds,
  };
}

async function upsertPatientSettings({
  patientIds,
  cxId,
  adtSubscription,
  transaction,
}: {
  patientIds: string[];
  cxId: string;
  adtSubscription: boolean;
  transaction: Transaction;
}): Promise<number> {
  const existingSettings = await PatientSettingsModel.findAll({
    where: { patientId: patientIds, cxId },
    transaction,
  });
  const existingSettingsMap = new Map(existingSettings.map(s => [s.patientId, s]));

  const upserts = patientIds.map(patientId => ({
    id: existingSettingsMap.get(patientId)?.id ?? uuidv7(),
    cxId,
    patientId,
    adtSubscription,
  }));

  await PatientSettingsModel.bulkCreate(upserts, {
    updateOnDuplicate: ["adtSubscription"],
    transaction,
  });

  return upserts.length;
}
