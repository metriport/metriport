import { MedicationRequest } from "@medplum/fhirtypes";
import { combineResources, fillMaps, pickMostDescriptiveStatus } from "../shared";

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

export function deduplicateMedRequests(medications: MedicationRequest[]): {
  combinedMedRequests: MedicationRequest[];
  refReplacementMap: Map<string, string[]>;
} {
  const { medRequestsMap, refReplacementMap } = groupSameMedRequests(medications);
  return {
    combinedMedRequests: combineResources({
      combinedMaps: [medRequestsMap],
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
  refReplacementMap: Map<string, string[]>;
} {
  const medRequestsMap = new Map<string, MedicationRequest>();
  const refReplacementMap = new Map<string, string[]>();

  function assignMostDescriptiveStatus(
    master: MedicationRequest,
    existing: MedicationRequest,
    target: MedicationRequest
  ): MedicationRequest {
    master.status = pickMostDescriptiveStatus(statusRanking, existing.status, target.status);
    return master;
  }

  for (const medRequest of medRequests) {
    const medRef = medRequest.medicationReference?.reference;
    const date = medRequest.authoredOn;
    // TODO: Deduplicate Practitioners prior to MedicationRequests, so the reference to requester can also be used for key?

    if (medRef && date) {
      // TODO: Include medRequest.dosage into the key when we start mapping it on the FHIR converter
      const key = JSON.stringify({ medRef, date });
      fillMaps(
        medRequestsMap,
        key,
        medRequest,
        refReplacementMap,
        undefined,
        assignMostDescriptiveStatus
      );
    }
  }

  return {
    medRequestsMap,
    refReplacementMap: refReplacementMap,
  };
}