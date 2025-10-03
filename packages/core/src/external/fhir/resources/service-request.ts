import { ServiceRequest } from "@medplum/fhirtypes";
import { CodeableConcept } from "@medplum/fhirtypes";
import { SNOMED_URL } from "@metriport/shared/medical";

export const SERVICE_REQUEST_CATEGORY_NAMES = [
  "Laboratory procedure",
  "Imaging",
  "Counselling",
  "Education",
  "Surgical Procedure",
] as const;
export type ServiceRequestCategoryName = (typeof SERVICE_REQUEST_CATEGORY_NAMES)[number];

export const SERVICE_REQUEST_CATEGORY_SNOMED_CODE: Record<ServiceRequestCategoryName, string> = {
  "Laboratory procedure": "108252007",
  Imaging: "363679005",
  Counselling: "409063005",
  Education: "409073007",
  "Surgical Procedure": "387713003",
};

export function getServiceRequestCategory(
  categoryName: ServiceRequestCategoryName
): CodeableConcept {
  return {
    coding: [
      {
        system: SNOMED_URL,
        code: SERVICE_REQUEST_CATEGORY_SNOMED_CODE[categoryName],
        display: categoryName,
      },
    ],
  };
}

// Service request statuses in order of deduplication priority
export const SERVICE_REQUEST_STATUS_CODES = [
  "unknown",
  "draft",
  "active",
  "on-hold",
  "revoked",
  "entered-in-error",
  "completed",
] as const;
export type ServiceRequestStatusCode = (typeof SERVICE_REQUEST_STATUS_CODES)[number];

export function compareServiceRequestsByStatus(a: ServiceRequest, b: ServiceRequest): number {
  const aIndex = SERVICE_REQUEST_STATUS_CODES.indexOf(a.status ?? "unknown");
  const bIndex = SERVICE_REQUEST_STATUS_CODES.indexOf(b.status ?? "unknown");
  return aIndex - bIndex;
}
