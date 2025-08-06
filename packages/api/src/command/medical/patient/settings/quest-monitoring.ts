import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { QueryTypes } from "sequelize";
import { PatientSettingsModel } from "../../../../models/patient-settings";
import { processPatientsInBatches } from "../batch-utils";
import { PatientListProcessingResult, verifyPatients } from "./common";

/**
 * Appends a Quest monitoring subscription to the patient settings for the given customer and patient IDs.
 *
 * @param cxId - The customer ID
 * @param patientIds - The patient IDs to add monitoring for.
 * @returns The number of patients updated and the list of patients not found.
 */
export async function addQuestSubscriptionToPatients({
  cxId,
  patientIds,
}: {
  cxId: string;
  patientIds: string[];
}): Promise<PatientListProcessingResult> {
  const { validPatientIds, invalidPatientIds: patientsNotFound } = await verifyPatients({
    cxId,
    patientIds,
  });

  async function batchProcessor(batch: string[]): Promise<void> {
    await _addQuestSubscriptionToPatients({
      patientIds: batch,
      cxId,
    });
  }

  const result = await processPatientsInBatches(validPatientIds, batchProcessor, {
    cxId,
    operationName: "addQuestSubscriptionToPatients",
    errorMessage: "Failed to append Quest monitoring subscriptions for patients",
    throwOnNoPatients: true,
  });

  return {
    ...result,
    patientsNotFound,
  };
}

/**
 * Removes a Quest monitoring subscription from the patient settings for the given customer and patient IDs.
 *
 * @param cxId The customer ID
 * @param patientIds The patient IDs to remove Quest monitoring subscriptions for.
 * @returns The number of patients updated and the list of patients not found
 */
export async function removeQuestSubscriptionFromPatients({
  cxId,
  patientIds,
}: {
  cxId: string;
  patientIds: string[];
}): Promise<PatientListProcessingResult> {
  const { validPatientIds, invalidPatientIds: patientsNotFound } = await verifyPatients({
    cxId,
    patientIds,
  });

  async function batchProcessor(batch: string[]): Promise<void> {
    await _removeQuestSubscriptionsFromPatients({
      patientIds: batch,
      cxId,
    });
  }

  const result = await processPatientsInBatches(validPatientIds, batchProcessor, {
    cxId,
    operationName: "removeQuestSubscriptionFromPatients",
    errorMessage: "Failed to remove Quest monitoring subscriptions for patients",
    throwOnNoPatients: true,
  });

  return {
    ...result,
    patientsNotFound,
  };
}

/**
 * Adds a Quest monitoring subscription to patient settings if not already present
 */
async function _addQuestSubscriptionToPatients({
  patientIds,
  cxId,
}: {
  patientIds: string[];
  cxId: string;
}): Promise<void> {
  const sequelize = PatientSettingsModel.sequelize;
  if (!sequelize) {
    throw new Error("Sequelize instance not available");
  }

  // Create patient settings records for patients who don't have them yet
  await PatientSettingsModel.bulkCreate(
    patientIds.map(patientId => ({
      id: uuidv7(),
      cxId,
      patientId,
      subscriptions: {
        quest: true,
      },
    })),
    {
      ignoreDuplicates: true,
    }
  );

  // Add Quest monitoring subscription to existing subscriptions (only if not already present)
  // SQL explanation: If Quest monitoring already in array, keep current array, otherwise append Quest monitoring to array
  const addSubscriptionQuery = `
    UPDATE patient_settings 
    SET 
        subscriptions = jsonb_set(subscriptions, '{quest}', 'true'::jsonb, true),
        updated_at = NOW()
    WHERE cx_id = :cxId::uuid 
      AND patient_id in (:patientIds)
      AND subscriptions->'quest' IS DISTINCT FROM 'true'::jsonb
  `;

  await sequelize.query(addSubscriptionQuery, {
    replacements: {
      cxId,
      patientIds,
    },
    type: QueryTypes.UPDATE,
  });
}

/**
 * Removes an HIE subscription from patient settings if present
 */
async function _removeQuestSubscriptionsFromPatients({
  patientIds,
  cxId,
}: {
  patientIds: string[];
  cxId: string;
}): Promise<void> {
  const sequelize = PatientSettingsModel.sequelize;
  if (!sequelize) {
    throw new Error("Sequelize instance not available");
  }

  // Remove Quest monitoring subscription from existing subscriptions (only if it exists)
  // SQL explanation: Convert JSON array to text array, remove Quest monitoring, convert back to JSON
  const removeSubscriptionQuery = `
    UPDATE patient_settings 
    SET 
        subscriptions = jsonb_remove(subscriptions, '{quest}'),
        updated_at = NOW()
    WHERE cx_id = :cxId::uuid 
      AND patient_id in (:patientIds)
      AND subscriptions->'quest' = true
  `;

  await sequelize.query(removeSubscriptionQuery, {
    replacements: {
      cxId,
      patientIds,
    },
    type: QueryTypes.UPDATE,
  });
}
