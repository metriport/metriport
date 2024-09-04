import { MedicationAdministration } from "@medplum/fhirtypes";
import {
  DeduplicationResult,
  combineResources,
  createRef,
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

export function deduplicateMedAdmins(
  medications: MedicationAdministration[]
): DeduplicationResult<MedicationAdministration> {
  const { medAdminsMap, refReplacementMap, danglingReferences } = groupSameMedAdmins(medications);
  return {
    combinedResources: combineResources({
      combinedMaps: [medAdminsMap],
    }),
    refReplacementMap,
    danglingReferences,
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
  danglingReferences: string[];
} {
  const medAdminsMap = new Map<string, MedicationAdministration>();
  const refReplacementMap = new Map<string, string[]>();
  const danglingReferencesSet = new Set<string>();

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
    const datetime = getDateFromResource(medAdmin, "datetime");
    const dosage = medAdmin.dosage;

    if (medRef && datetime && dosage) {
      const key = JSON.stringify({ medRef, datetime, dosage });
      fillMaps(
        medAdminsMap,
        key,
        medAdmin,
        refReplacementMap,
        undefined,
        assignMostDescriptiveStatus
      );
    } else {
      danglingReferencesSet.add(createRef(medAdmin));
    }
  }

  return {
    medAdminsMap,
    refReplacementMap: refReplacementMap,
    danglingReferences: [...danglingReferencesSet],
  };
}
