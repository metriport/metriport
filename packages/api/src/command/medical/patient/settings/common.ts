import { PatientSettingsData } from "@metriport/core/domain/patient-settings";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { Op } from "sequelize";
import { PatientModel } from "../../../../models/medical/patient";
import { PatientSettingsModel } from "../../../../models/patient-settings";

export type PatientSettingsUpsertForCxProps = {
  cxId: string;
  facilityId?: string;
  settings: PatientSettingsData;
};

export type PatientSettingsUpsertProps = PatientSettingsUpsertForCxProps & {
  patientIds: string[];
};

/**
 * Result when processing a specific list of patients
 */
export type PatientListProcessingResult = {
  patientsFoundAndUpdated: number;
  patientsNotFound: string[]; // Always present - empty array if all found
  failedCount?: number; // Only present if some failed
  failedIds?: string[]; // Only present if some failed
};

/**
 * Result when processing all patients for a customer
 */
export type CustomerProcessingResult = {
  patientsFoundAndUpdated: number;
  failedCount?: number; // Only present if some failed
  failedIds?: string[]; // Only present if some failed
};

export async function verifyPatients({
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

export async function upsertPatientSettings({
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
