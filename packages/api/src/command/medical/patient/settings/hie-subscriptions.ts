import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { QueryTypes } from "sequelize";
import { PatientSettingsModel } from "../../../../models/patient-settings";
import { processPatientsInBatches } from "../batch-utils";
import { PatientListProcessingResult, verifyPatients } from "./common";

/**
 * Appends an ADT subscription to the patient settings for the given customer and patient IDs.
 *
 * @param cxId The customer ID
 * @param facilityId The facility ID. Optional.
 * @param patientIds The patient IDs to upsert patient settings for.
 * @param hieName The HIE name to subscribe to
 * @returns The number of patients updated and the list of patients not found
 */
export async function addHieSubscriptionToPatients({
  cxId,
  patientIds,
  hieName,
}: {
  cxId: string;
  patientIds: string[];
  hieName: string;
}): Promise<PatientListProcessingResult> {
  const { validPatientIds, invalidPatientIds: patientsNotFound } = await verifyPatients({
    cxId,
    patientIds,
  });

  async function batchProcessor(batch: string[]): Promise<void> {
    await _addHieSubscriptionToPatients({
      patientIds: batch,
      cxId,
      hieName,
    });
  }

  const result = await processPatientsInBatches(validPatientIds, batchProcessor, {
    cxId,
    operationName: "addHieSubscriptionToPatients",
    errorMessage: "Failed to append ADT subscriptions for patients",
    throwOnNoPatients: true,
  });

  return {
    ...result,
    patientsNotFound,
  };
}

/**
 * Removes an ADT subscription from the patient settings for the given customer and patient IDs.
 *
 * @param cxId The customer ID
 * @param patientIds The patient IDs to remove ADT subscriptions for.
 * @param hieName The HIE name to unsubscribe from
 * @returns The number of patients updated and the list of patients not found
 */
export async function removeHieSubscriptionFromPatients({
  cxId,
  patientIds,
  hieName,
}: {
  cxId: string;
  patientIds: string[];
  hieName: string;
}): Promise<PatientListProcessingResult> {
  const { validPatientIds, invalidPatientIds: patientsNotFound } = await verifyPatients({
    cxId,
    patientIds,
  });

  async function batchProcessor(batch: string[]): Promise<void> {
    await _removeHieSubscriptionsFromPatients({
      patientIds: batch,
      cxId,
      hieName,
    });
  }

  const result = await processPatientsInBatches(validPatientIds, batchProcessor, {
    cxId,
    operationName: "removeHieSubscriptionFromPatients",
    errorMessage: "Failed to remove ADT subscriptions for patients",
    throwOnNoPatients: true,
  });

  return {
    ...result,
    patientsNotFound,
  };
}

/**
 * Adds an HIE subscription to patient settings if not already present
 */
async function _addHieSubscriptionToPatients({
  patientIds,
  cxId,
  hieName,
}: {
  patientIds: string[];
  cxId: string;
  hieName: string;
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
        adt: [hieName],
      },
    })),
    {
      ignoreDuplicates: true,
    }
  );

  // Add HIE name to existing subscriptions (only if not already present)
  // SQL explanation: If HIE already in array, keep current array, otherwise append HIE to array
  const addSubscriptionQuery = `
    UPDATE patient_settings 
    SET 
        subscriptions = jsonb_set(subscriptions, '{adt}', 
            CASE 
                WHEN subscriptions->'adt' @> to_jsonb(:hieName::text) 
                THEN subscriptions->'adt'
                ELSE COALESCE(subscriptions->'adt', '[]'::jsonb) || to_jsonb(:hieName::text)
            END
        ),
        updated_at = NOW()
    WHERE cx_id = :cxId::uuid 
      AND patient_id in (:patientIds)
      AND NOT (subscriptions->'adt' @> to_jsonb(:hieName::text))
  `;

  await sequelize.query(addSubscriptionQuery, {
    replacements: {
      cxId,
      patientIds,
      hieName,
    },
    type: QueryTypes.UPDATE,
  });
}

/**
 * Removes an HIE subscription from patient settings if present
 */
async function _removeHieSubscriptionsFromPatients({
  patientIds,
  cxId,
  hieName,
}: {
  patientIds: string[];
  cxId: string;
  hieName: string;
}): Promise<void> {
  const sequelize = PatientSettingsModel.sequelize;
  if (!sequelize) {
    throw new Error("Sequelize instance not available");
  }

  // Remove HIE name from existing subscriptions (only if it exists)
  // SQL explanation: Convert JSON array to text array, remove HIE name, convert back to JSON
  const removeSubscriptionQuery = `
    UPDATE patient_settings 
    SET 
        subscriptions = jsonb_set(subscriptions, '{adt}', 
          to_jsonb(array_remove(
              ARRAY(SELECT jsonb_array_elements_text(subscriptions->'adt')), 
              :hieName::text
          ))
        ),
        updated_at = NOW()
    WHERE cx_id = :cxId::uuid 
      AND patient_id in (:patientIds)
      AND subscriptions->'adt' @> to_jsonb(:hieName::text)
  `;

  await sequelize.query(removeSubscriptionQuery, {
    replacements: {
      cxId,
      patientIds,
      hieName,
    },
    type: QueryTypes.UPDATE,
  });
}
