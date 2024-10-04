import { ResourceTypeForConsolidation } from "@metriport/api-sdk";

export type ResourceCount = {
  total: number;
  resources: {
    [key in ResourceTypeForConsolidation]?: number;
  };
};
