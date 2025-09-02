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
