import { ResourceTypeForConsolidation } from "@metriport/api-sdk";
import { ConsolidatedSnapshotRequest } from "./get-snapshot";

export type ConsolidatedCounterRequest = ConsolidatedSnapshotRequest;

export type ConsolidatedCounterResponse = {
  total: number;
  resources: {
    [key in ResourceTypeForConsolidation]?: number;
  };
};

export interface ConsolidatedCounter {
  execute(params: ConsolidatedCounterRequest): Promise<ConsolidatedCounterResponse>;
}
