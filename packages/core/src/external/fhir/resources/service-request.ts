import { ServiceRequest } from "@medplum/fhirtypes";

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
