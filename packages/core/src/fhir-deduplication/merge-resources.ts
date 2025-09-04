import { Resource } from "@medplum/fhirtypes";
import { MetriportError } from "@metriport/shared";
import { mergeIntoTargetResource } from "./shared";

export type MergeFunction<R extends Resource> = (resources: R[]) => R;

export function buildMergeFunction<R extends Resource>(): MergeFunction<R> {
  return function (resources: R[]): R {
    if (resources.length === 0) {
      throw new MetriportError("Merge is always called with at least one resource");
    }
    const masterResource = resources[0];
    if (!masterResource) {
      throw new MetriportError("Merge is always called with at least one resource");
    }
    for (let i = 1; i < resources.length; i++) {
      const resource = resources[i];
      if (!resource) continue;
      mergeIntoTargetResource(masterResource, resource);
    }
    return masterResource;
  };
}
