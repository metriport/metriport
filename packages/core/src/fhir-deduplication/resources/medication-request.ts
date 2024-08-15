import { MedicationRequest } from "@medplum/fhirtypes";
import { combineResources, fillMaps } from "../shared";

export function deduplicateMedRequests(medications: MedicationRequest[]): {
  combinedMedRequests: MedicationRequest[];
  refReplacementMap: Map<string, string[]>;
} {
  const { medRequestsMap, remainingMedRequests, refReplacementMap } =
    groupSameMedRequests(medications);
  return {
    combinedMedRequests: combineResources({
      combinedMaps: [medRequestsMap],
      remainingResources: remainingMedRequests,
    }),
    refReplacementMap,
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
  remainingMedRequests: MedicationRequest[];
  refReplacementMap: Map<string, string[]>;
} {
  const medRequestsMap = new Map<string, MedicationRequest>();
  const refReplacementMap = new Map<string, string[]>();
  const remainingMedRequests: MedicationRequest[] = [];

  for (const medRequest of medRequests) {
    const medRef = medRequest.medicationReference?.reference;
    const status = medRequest.status;
    // TODO: Deduplicate Practitioners prior to MedicationRequests, so the reference to requester can also be used for key?

    if (medRef) {
      const key = JSON.stringify({ medRef, status });
      fillMaps(medRequestsMap, key, medRequest, refReplacementMap);
    } else {
      remainingMedRequests.push(medRequest);
    }
  }

  return {
    medRequestsMap,
    remainingMedRequests,
    refReplacementMap: refReplacementMap,
  };
}
