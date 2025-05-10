import { MedicationRequest } from "@medplum/fhirtypes";
import {
  DeduplicationResult,
  assignMostDescriptiveStatus,
  combineResources,
  createRef,
  deduplicateWithinMap,
  getDateFromString,
} from "../shared";

const medicationRequestStatus = [
  "active",
  "completed",
  "entered-in-error",
  "stopped",
  "on-hold",
  "unknown",
  "cancelled",
  "draft",
] as const;
export type MedicationRequestStatus = (typeof medicationRequestStatus)[number];

const statusRanking: Record<MedicationRequestStatus, number> = {
  unknown: 0,
  "entered-in-error": 1,
  draft: 2,
  "on-hold": 3,
  active: 4,
  stopped: 5,
  cancelled: 6,
  completed: 7,
};

function preprocessStatus(existing: MedicationRequest, target: MedicationRequest) {
  return assignMostDescriptiveStatus(statusRanking, existing, target);
}

export function deduplicateMedRequests(
  medications: MedicationRequest[]
): DeduplicationResult<MedicationRequest> {
  const { medRequestsMap, refReplacementMap, danglingReferences } =
    groupSameMedRequests(medications);
  return {
    combinedResources: combineResources({
      combinedMaps: [medRequestsMap],
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
export function groupSameMedRequests(medRequests: MedicationRequest[]): {
  medRequestsMap: Map<string, MedicationRequest>;
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
} {
  const medRequestsMap = new Map<string, MedicationRequest>();
  const refReplacementMap = new Map<string, string>();
  const danglingReferences = new Set<string>();

  for (const medRequest of medRequests) {
    const medRef = medRequest.medicationReference?.reference;
    const date = medRequest.authoredOn;

    if (medRef && date) {
      const datetime = getDateFromString(date, "datetime");
      // TODO: Include medRequest.dosage into the key when we start mapping it on the FHIR converter
      const key = JSON.stringify({ medRef, datetime });
      deduplicateWithinMap({
        dedupedResourcesMap: medRequestsMap,
        dedupKey: key,
        candidateResource: medRequest,
        refReplacementMap,
        onPremerge: preprocessStatus,
      });
    } else {
      danglingReferences.add(createRef(medRequest));
    }
  }

  return {
    medRequestsMap,
    refReplacementMap: refReplacementMap,
    danglingReferences,
  };
}
