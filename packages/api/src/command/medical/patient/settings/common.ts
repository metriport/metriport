import { PatientSettingsData } from "@metriport/core/domain/patient-settings";
import { Op } from "sequelize";
import { PatientModel } from "../../../../models/medical/patient";

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
