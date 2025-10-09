import { DocumentQueryStatus } from "./document-query";

export type NetworkQueryProgress = {
  networks: SourceQueryProgress[];
};

export const networkSources = ["hie", "surescripts"] as const;
export type NetworkSource = (typeof networkSources)[number];

export type SourceQueryProgress = {
  source: NetworkSource;
  status: DocumentQueryStatus;
  startedAt?: Date;
  requestId?: string;
};
