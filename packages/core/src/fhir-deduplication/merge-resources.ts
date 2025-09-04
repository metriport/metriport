import { Resource } from "@medplum/fhirtypes";
import { MetriportError } from "@metriport/shared";
import { mergeIntoTargetResource } from "./shared";

export type MergeFunction<R extends Resource> = (resources: R[]) => R;
export type MergeKeyFunction<R extends Resource, K extends keyof R> = (values: Array<R[K]>) => R[K];

export interface MergeConfig<R extends Resource> {
  resourceType: string;
  /**
   * Precedence of resource statuses from highest to lowest.
   */
  chooseMasterResource?: (resources: R[]) => R;
  statusPrecedence?: string[];
  mergeKey: {
    [K in keyof R]?: MergeKeyFunction<R, K>;
  };
}

export function buildMergeFunction<R extends Resource>({
  statusPrecedence,
  chooseMasterResource,
}: MergeConfig<R>): MergeFunction<R> {
  const orderingFunction = statusPrecedence
    ? buildStatusOrderingFunction<R>(statusPrecedence)
    : (resources: R[]) => resources;
  const masterResourceFunction = chooseMasterResource ? chooseMasterResource : chooseLastResource;

  return function (resources: R[]): R {
    const orderedResources = orderingFunction(resources);
    const masterResource = masterResourceFunction(orderedResources);

    for (let i = 1; i < resources.length; i++) {
      const resource = resources[i];
      if (!resource || resource === masterResource) continue;
      mergeIntoTargetResource(masterResource, resource);
    }
    return masterResource;
  };
}

function chooseLastResource<R extends Resource>(resources: R[]): R {
  const lastResource = resources[resources.length - 1];
  if (!lastResource) {
    throw new MetriportError("Merge is always called with at least one resource");
  }
  return lastResource;
}

function buildStatusOrderingFunction<R extends Resource>(
  statusPrecedence: string[]
): (resources: R[]) => R[] {
  const statusPrecedenceIndex = new Map(statusPrecedence.map((status, index) => [status, index]));

  return function (resources: R[]): R[] {
    return [...resources].sort((a, b) => {
      const aStatus = getStatus(a);
      if (!aStatus) return -1;
      const bStatus = getStatus(b);
      if (!bStatus) return 1;

      const aIndex = statusPrecedenceIndex.get(aStatus);
      const bIndex = statusPrecedenceIndex.get(bStatus);
      if (aIndex === undefined || bIndex === undefined) {
        return 0;
      }
      return aIndex - bIndex;
    });
  };
}

function getStatus(resource: Resource): string | undefined {
  if (!("status" in resource)) {
    return undefined;
  }
  if (typeof resource.status !== "string") {
    return undefined;
  }
  return resource.status;
}
