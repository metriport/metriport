export { bulkUpdateDatasourceQueryStatus } from "./api/bulk-update-datasource-query-status";
export { updateNetworkQueryStatus } from "./api/update-network-query-status";
export type {
  BulkPatientIdentifier,
  BulkUpdateDatasourceQueryStatusParams,
  BulkUpdateResult,
  GetNetworkQueryStatusParams,
  UpdateNetworkQueryStatusParams,
} from "./api/api-shared";

// Re-export domain types from shared for convenience
export { networkQueryTrackingStatus, NetworkSource } from "@metriport/shared/domain/network-query";
export type { NetworkQueryTrackingStatus } from "@metriport/shared/domain/network-query";
