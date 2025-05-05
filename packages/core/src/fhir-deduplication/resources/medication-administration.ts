import { MedicationAdministration } from "@medplum/fhirtypes";
import {
  DeduplicationResult,
  assignMostDescriptiveStatus,
  combineResources,
  createRef,
  deduplicateWithinMap,
  getDateFromResource,
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

function preprocessStatus(existing: MedicationAdministration, target: MedicationAdministration) {
  return assignMostDescriptiveStatus(statusRanking, existing, target);
}

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
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
} {
  const medAdminsMap = new Map<string, MedicationAdministration>();
  const refReplacementMap = new Map<string, string>();
  const danglingReferences = new Set<string>();

  for (const medAdmin of medAdmins) {
    const medRef = medAdmin.medicationReference?.reference;
    const datetime = getDateFromResource(medAdmin, "datetime");
    const dosage = medAdmin.dosage;

    if (medRef && datetime && dosage) {
      const key = JSON.stringify({ medRef, datetime, dosage });
      deduplicateWithinMap(
        medAdminsMap,
        key,
        medAdmin,
        refReplacementMap,
        undefined,
        preprocessStatus
      );
    } else if (medRef && datetime) {
      const key = JSON.stringify({ medRef, datetime });
      deduplicateWithinMap(
        medAdminsMap,
        key,
        medAdmin,
        refReplacementMap,
        undefined,
        preprocessStatus
      );
    } else {
      danglingReferences.add(createRef(medAdmin));
    }
  }

  return {
    medAdminsMap,
    refReplacementMap: refReplacementMap,
    danglingReferences,
  };
}
