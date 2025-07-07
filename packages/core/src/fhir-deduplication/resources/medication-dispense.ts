import { MedicationDispense } from "@medplum/fhirtypes";
import {
  DeduplicationResult,
  assignMostDescriptiveStatus,
  combineResources,
  createRef,
  deduplicateWithinMap,
  getDateFromString,
} from "../shared";

const medicationDispenseStatus = [
  "active",
  "completed",
  "entered-in-error",
  "stopped",
  "on-hold",
  "unknown",
  "cancelled",
  "draft",
] as const;
export type MedicationDispenseStatus = (typeof medicationDispenseStatus)[number];

const statusRanking: Record<MedicationDispenseStatus, number> = {
  unknown: 0,
  "entered-in-error": 1,
  draft: 2,
  "on-hold": 3,
  active: 4,
  stopped: 5,
  cancelled: 6,
  completed: 7,
};

function preprocessStatus(existing: MedicationDispense, target: MedicationDispense) {
  return assignMostDescriptiveStatus(statusRanking, existing, target);
}

export function deduplicateMedDispenses(
  medications: MedicationDispense[]
): DeduplicationResult<MedicationDispense> {
  const { medDispensesMap, refReplacementMap, danglingReferences } =
    groupSameMedDispenses(medications);
  return {
    combinedResources: combineResources({
      combinedMaps: [medDispensesMap],
    }),
    refReplacementMap,
    danglingReferences,
  };
}

/**
 * Approach:
 * 1 map, where the key is made of:
 * - medicationReference ID
 * - status
 */
export function groupSameMedDispenses(medDispenses: MedicationDispense[]): {
  medDispensesMap: Map<string, MedicationDispense>;
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
} {
  const medDispensesMap = new Map<string, MedicationDispense>();
  const refReplacementMap = new Map<string, string>();
  const danglingReferences = new Set<string>();

  for (const medDispense of medDispenses) {
    const medRef = medDispense.medicationReference?.reference;
    const date = medDispense.whenHandedOver;
    const daysSupply = medDispense.daysSupply;
    if (medRef && date && daysSupply) {
      const datetime = getDateFromString(date, "datetime");
      const key = JSON.stringify({ medRef, datetime, daysSupply });
      deduplicateWithinMap({
        dedupedResourcesMap: medDispensesMap,
        dedupKey: key,
        candidateResource: medDispense,
        refReplacementMap,
        onPremerge: preprocessStatus,
      });
    } else if (medRef && date) {
      const datetime = getDateFromString(date, "datetime");
      const key = JSON.stringify({ medRef, datetime });
      deduplicateWithinMap({
        dedupedResourcesMap: medDispensesMap,
        dedupKey: key,
        candidateResource: medDispense,
        refReplacementMap,
        onPremerge: preprocessStatus,
      });
    } else if (medRef) {
      const key = JSON.stringify({ medRef });
      deduplicateWithinMap({
        dedupedResourcesMap: medDispensesMap,
        dedupKey: key,
        candidateResource: medDispense,
        refReplacementMap,
        onPremerge: preprocessStatus,
      });
    } else {
      danglingReferences.add(createRef(medDispense));
    }
  }

  return {
    medDispensesMap,
    refReplacementMap: refReplacementMap,
    danglingReferences,
  };
}
