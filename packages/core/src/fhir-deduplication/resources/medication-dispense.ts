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

export function deduplicateMedDipenses(
  medications: MedicationDispense[]
): DeduplicationResult<MedicationDispense> {
  const { medDipensesMap, refReplacementMap, danglingReferences } =
    groupSameMedDipenses(medications);
  return {
    combinedResources: combineResources({
      combinedMaps: [medDipensesMap],
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
export function groupSameMedDipenses(medDipenses: MedicationDispense[]): {
  medDipensesMap: Map<string, MedicationDispense>;
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
} {
  const medDipensesMap = new Map<string, MedicationDispense>();
  const refReplacementMap = new Map<string, string>();
  const danglingReferences = new Set<string>();

  for (const medDipense of medDipenses) {
    const medRef = medDipense.medicationReference?.reference;
    const date = medDipense.whenHandedOver;
    // const quantity = medDipense.quantity;
    // if (medRef && date && quantity) {
    //   const datetime = getDateFromString(date, "datetime");
    //   const key = JSON.stringify({ medRef, datetime, quantity });
    //   deduplicateWithinMap({
    //     dedupedResourcesMap: medDipensesMap,
    //     dedupKey: key,
    //     candidateResource: medDipense,
    //     refReplacementMap,
    //     onPremerge: preprocessStatus,
    //   });
    // } else
    if (medRef && date) {
      const datetime = getDateFromString(date, "datetime");
      const key = JSON.stringify({ medRef, datetime });
      deduplicateWithinMap({
        dedupedResourcesMap: medDipensesMap,
        dedupKey: key,
        candidateResource: medDipense,
        refReplacementMap,
        onPremerge: preprocessStatus,
      });
    } else if (medRef) {
      const key = JSON.stringify({ medRef });
      deduplicateWithinMap({
        dedupedResourcesMap: medDipensesMap,
        dedupKey: key,
        candidateResource: medDipense,
        refReplacementMap,
        onPremerge: preprocessStatus,
      });
    } else {
      danglingReferences.add(createRef(medDipense));
    }
  }

  return {
    medDipensesMap,
    refReplacementMap: refReplacementMap,
    danglingReferences,
  };
}
