import { GetConsolidatedFilters } from "./consolidated-query";

export const queryStatus = ["processing", "completed", "failed"] as const;
export type QueryStatus = (typeof queryStatus)[number];

export type QueryProgress = {
  status: QueryStatus | undefined;
  startedAt?: Date;
};

export type PatientDiscovery = {
  startedAt: Date;
  requestId: string;
};

export type ConsolidatedQuery = GetConsolidatedFilters &
  QueryProgress & {
    requestId: string;
  };
