import { Resource } from "@medplum/fhirtypes";
import { MetriportError } from "@metriport/shared";
import { MergeConfig, MergeFunction } from "./types";
import { buildStatusOrderingFunction } from "./status";

export function buildMergeFunction<R extends Resource>({
  statusPrecedence,
  chooseMasterResource,
}: MergeConfig<R>): MergeFunction<R> {
  const orderingFunction = buildStatusOrderingFunction<R>(statusPrecedence);
  const masterResourceFunction = chooseMasterResource ? chooseMasterResource : chooseLastResource;

  return function (resources: R[]): R {
    const orderedResources = orderingFunction(resources);
    const masterResource = masterResourceFunction(orderedResources);

    for (const resource of orderedResources) {
      if (resource === masterResource) continue;
      // mergeIntoTargetResource(masterResource, resource);
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
