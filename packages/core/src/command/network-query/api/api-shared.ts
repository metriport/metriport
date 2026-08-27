import { NetworkQueryTrackingStatus, NetworkSource } from "@metriport/shared/domain/network-query";
import axios, { AxiosInstance } from "axios";
import { Config } from "../../../util/config";

export const NETWORK_QUERY_ROUTE = "/internal/network-query";

export function getApi(): AxiosInstance {
  return axios.create({ baseURL: Config.getApiUrl(), timeout: 120_000 });
}

export type UpdateNetworkQueryStatusParams = {
  cxId: string;
  patientId: string;
  requestId?: string;
  source: NetworkSource;
  /** Specific source provider (e.g., "national-hie", "surescripts", "quest") */
  specificSource: string;
  toStatus: NetworkQueryTrackingStatus;
  /** Optional: Which statuses are eligible to be updated. Only used for patient-based updates.
   * For requestId updates, this is ignored. For patient updates, defaults are inferred from
   * toStatus and source if not provided. */
  fromStatuses?: NetworkQueryTrackingStatus[];
  /** Filter by rosterId stored in data.rosterId. Used to ensure updates are only
   * made for datasource queries that belong to a specific roster. */
  rosterId?: string;
};

export type BulkPatientIdentifier = {
  cxId: string;
  patientId: string;
};

export type BulkUpdateDatasourceQueryStatusParams = {
  patients: BulkPatientIdentifier[];
  source: NetworkSource;
  /** Specific source provider (e.g., "national-hie", "surescripts", "quest") */
  specificSource: string;
  /** Optional: Which statuses are eligible to be updated. Defaults are inferred from
   * toStatus and source if not provided. */
  fromStatuses?: NetworkQueryTrackingStatus[];
  toStatus: NetworkQueryTrackingStatus;
  /** Filter by rosterId stored in data.rosterId. Used to ensure updates are only
   * made for datasource queries that belong to a specific roster. */
  rosterId?: string;
};

export type BulkUpdateResult = {
  updatedCount: number;
  patientsUpdated: BulkPatientIdentifier[];
  patientsNotFound: BulkPatientIdentifier[];
};

export type GetNetworkQueryStatusParams = {
  cxId: string;
  requestId: string;
};
