import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { QueryTypes } from "sequelize";
import { PatientSettingsModel } from "../../../../models/patient-settings";
import { processPatientsInBatches } from "../batch-utils";
import { PatientListProcessingResult, verifyPatients } from "./common";

// type QuestSettingsKey = "questBackfill" | "questMonitoring";

/**
 * Appends a Quest monitoring subscription to the patient settings for the given customer and patient IDs.
 *
 * @param cxId - The customer ID
 * @param patientIds - The patient IDs to add monitoring for.
 * @param backfill - Whether to add a Quest backfill subscription for historical lab results.
 * @param monitoring - Whether to add a Quest monitoring subscription for real-time notifications of new lab results.
 * @returns The number of patients updated and the list of patients not found.
 */
export async function addQuestSubscriptionToPatients({
  cxId,
  patientIds,
  backfill,
  monitoring,
}: {
  cxId: string;
  patientIds: string[];
  backfill?: boolean;
  monitoring?: boolean;
}): Promise<PatientListProcessingResult> {
  const { validPatientIds, invalidPatientIds: patientsNotFound } = await verifyPatients({
    cxId,
    patientIds,
  });

  async function batchProcessor(batch: string[]): Promise<void> {
    await _addQuestSubscriptionToPatients({
      patientIds: batch,
      cxId,
      backfill,
      monitoring,
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
  backfill,
  monitoring,
}: {
  cxId: string;
  patientIds: string[];
  backfill?: boolean;
  monitoring?: boolean;
}): Promise<PatientListProcessingResult> {
  const { validPatientIds, invalidPatientIds: patientsNotFound } = await verifyPatients({
    cxId,
    patientIds,
  });

  async function batchProcessor(batch: string[]): Promise<void> {
    await _removeQuestSubscriptionsFromPatients({
      patientIds: batch,
      cxId,
      backfill,
      monitoring,
    });
  }

  const result = await processPatientsInBatches(validPatientIds, batchProcessor, {
    cxId,
    operationName: "removeQuestSubscriptionFromPatients",
    errorMessage: "Failed to remove Quest settings for patients",
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
  backfill,
  monitoring,
}: {
  patientIds: string[];
  cxId: string;
  backfill?: boolean;
  monitoring?: boolean;
}): Promise<void> {
  const sequelize = PatientSettingsModel.sequelize;
  if (!sequelize) {
    throw new Error("Sequelize instance not available");
  }
  const settingsKey: "questBackfill" | "questMonitoring" = monitoring
    ? "questMonitoring"
    : "questBackfill";

  // Create patient settings records for patients who don't have them yet
  await PatientSettingsModel.bulkCreate(
    patientIds.map(patientId => ({
      id: uuidv7(),
      cxId,
      patientId,
      subscriptions: {
        [settingsKey]: true,
      },
    })),
    {
      ignoreDuplicates: true,
    }
  );

  // Add Quest monitoring subscription to existing subscriptions (only if not already present)
  // SQL explanation: If Quest monitoring already set to true, stays as true, otherwise set to true
  const initialSubscriptionObject = JSON.stringify({
    ...(backfill != null && { questBackfill: backfill }),
    ...(monitoring != null && { questMonitoring: monitoring }),
  });
  const addSubscriptionQuery = `
    UPDATE patient_settings 
    SET 
        subscriptions = CASE 
            WHEN subscriptions IS NULL OR jsonb_typeof(subscriptions) != 'object' THEN '${initialSubscriptionObject}'::jsonb
            ELSE jsonb_set(subscriptions, '{${settingsKey}}', 'true'::jsonb, true)
        END,
        updated_at = NOW()
    WHERE cx_id = :cxId::uuid 
      AND patient_id in (:patientIds)
      AND (subscriptions IS NULL OR subscriptions->'${settingsKey}' IS DISTINCT FROM 'true'::jsonb)
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
 * Removes a Quest monitoring subscription from patient settings if present
 */
async function _removeQuestSubscriptionsFromPatients({
  patientIds,
  cxId,
  backfill,
  monitoring,
}: {
  patientIds: string[];
  cxId: string;
  backfill?: boolean;
  monitoring?: boolean;
}): Promise<void> {
  const sequelize = PatientSettingsModel.sequelize;
  if (!sequelize) {
    throw new Error("Sequelize instance not available");
  }
  const settingsKeys: Array<"questBackfill" | "questMonitoring"> = [];
  if (backfill) {
    settingsKeys.push("questBackfill");
  }
  if (monitoring) {
    settingsKeys.push("questMonitoring");
  }

  // Remove Quest monitoring subscription from existing subscriptions (only if it exists)
  // SQL explanation: Use JSONB - operator to remove the 'quest' key from the subscriptions object
  const removeSubscriptionQuery = `
    UPDATE patient_settings 
    SET 
        subscriptions = subscriptions - '${settingsKeys.join("' - '")}',
        updated_at = NOW()
    WHERE cx_id = :cxId::uuid 
      AND patient_id in (:patientIds)
      AND subscriptions ? '${settingsKeys[0]}'
  `;

  await sequelize.query(removeSubscriptionQuery, {
    replacements: {
      cxId,
      patientIds,
    },
    type: QueryTypes.UPDATE,
  });
}
