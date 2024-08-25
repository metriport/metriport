import { MedicationAdministration } from "@medplum/fhirtypes";
import {
  combineResources,
  fillMaps,
  getDateFromResource,
  pickMostDescriptiveStatus,
} from "../shared";

const medicationAdministrationStatus = [
  "in-progress",
  "not-done",
  "on-hold",
  "completed",
  "entered-in-error",
  "stopped",
  "unknown",
] as const;
export type MedicationAdministrationStatus = (typeof medicationAdministrationStatus)[number];

const statusRanking: Record<MedicationAdministrationStatus, number> = {
  unknown: 0,
  "entered-in-error": 1,
  "on-hold": 2,
  "not-done": 3,
  "in-progress": 4,
  stopped: 5,
  completed: 6,
};

export function deduplicateMedAdmins(medications: MedicationAdministration[]): {
  combinedMedAdmins: MedicationAdministration[];
  refReplacementMap: Map<string, string[]>;
} {
  const { medAdminsMap, refReplacementMap } = groupSameMedAdmins(medications);
  return {
    combinedMedAdmins: combineResources({
      combinedMaps: [medAdminsMap],
    }),
    refReplacementMap,
  };
}

/**
 * Approach:
 * 1 map, where the key is made of:
 * - medicationReference ID
 * - date
 * - dosage
 */
export function groupSameMedAdmins(medAdmins: MedicationAdministration[]): {
  medAdminsMap: Map<string, MedicationAdministration>;
  refReplacementMap: Map<string, string[]>;
} {
  const medAdminsMap = new Map<string, MedicationAdministration>();
  const refReplacementMap = new Map<string, string[]>();

  function assignMostDescriptiveStatus(
    master: MedicationAdministration,
    existing: MedicationAdministration,
    target: MedicationAdministration
  ): MedicationAdministration {
    master.status = pickMostDescriptiveStatus(statusRanking, existing.status, target.status);
    return master;
  }

  for (const medAdmin of medAdmins) {
    const medRef = medAdmin.medicationReference?.reference;
    const date = getDateFromResource(medAdmin, "datetime");
    const dosage = medAdmin.dosage;

    if (medRef && date && dosage) {
      const key = JSON.stringify({ medRef, date, dosage });
      fillMaps(
        medAdminsMap,
        key,
        medAdmin,
        refReplacementMap,
        undefined,
        assignMostDescriptiveStatus
      );
    }
  }

  return {
    medAdminsMap,
    refReplacementMap: refReplacementMap,
  };
}
