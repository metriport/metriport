import { MedicationDispense } from "@medplum/fhirtypes";
import {
  DeduplicationResult,
  dangerouslyAssignMostDescriptiveStatus,
  combineResources,
  createRef,
  deduplicateWithinMap,
  getDateFromString,
} from "../shared";

const medicationDispenseStatus = [
  "preparation",
  "in-progress",
  "cancelled",
  "on-hold",
  "completed",
  "entered-in-error",
  "stopped",
  "declined",
  "unknown",
] as const;
export type MedicationDispenseStatus = (typeof medicationDispenseStatus)[number];

const statusRanking: Record<MedicationDispenseStatus, number> = {
  unknown: 0,
  "entered-in-error": 1,
  "in-progress": 2,
  "on-hold": 3,
  preparation: 4,
  cancelled: 5,
  completed: 6,
  stopped: 7,
  declined: 8,
};

function preprocessStatus(existing: MedicationDispense, target: MedicationDispense) {
  return dangerouslyAssignMostDescriptiveStatus(statusRanking, existing, target);
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
    const quantity = medDispense.quantity;

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
    } else if (medRef && date && quantity) {
      const datetime = getDateFromString(date, "datetime");
      const key = JSON.stringify({ medRef, datetime, quantity });
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
