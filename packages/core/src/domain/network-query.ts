import { DocumentQueryStatus } from "./document-query";

export type NetworkQueryParams = {
  cxId: string;
  facilityId: string;
  patientId: string;
};

export type NetworkQueryProgress = {
  networks: SourceQueryProgress[];
};

export const hieSource = "hie";
export const pharmacySource = "pharmacy";
export const laboratorySource = "laboratory";
export const networkSources = [hieSource, pharmacySource, laboratorySource] as const;
export type NetworkSource = (typeof networkSources)[number];

export type SourceQueryProgress = {
  type: NetworkSource;
  source?: string;
  status: DocumentQueryStatus;
  startedAt?: Date;
  requestId?: string;
  documents?: {
    downloadInProgress: number;
    downloaded: number;
    converted: number;
    failed: number;
    total: number;
  };
};
