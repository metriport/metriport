import { MedicationRequest } from "@medplum/fhirtypes";
import {
  DeduplicationResult,
  combineResources,
  createRef,
  fillMaps,
  getDateFromString,
  pickMostDescriptiveStatus,
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
  refReplacementMap: Map<string, string[]>;
  danglingReferences: string[];
} {
  const medRequestsMap = new Map<string, MedicationRequest>();
  const refReplacementMap = new Map<string, string[]>();
  const danglingReferencesSet = new Set<string>();

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

    if (medRef && date) {
      const datetime = getDateFromString(date, "datetime");
      // TODO: Include medRequest.dosage into the key when we start mapping it on the FHIR converter
      const key = JSON.stringify({ medRef, datetime });
      fillMaps(
        medRequestsMap,
        key,
        medRequest,
        refReplacementMap,
        undefined,
        assignMostDescriptiveStatus
      );
    } else {
      danglingReferencesSet.add(createRef(medRequest));
    }
  }

  return {
    medRequestsMap,
    refReplacementMap: refReplacementMap,
    danglingReferences: [...danglingReferencesSet],
  };
}
