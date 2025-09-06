import { Resource } from "@medplum/fhirtypes";
import { MergeStatusPrecedence, ResourceStatus } from "./types";

function defaultOrderingFunction<R extends Resource>(resources: R[]): R[] {
  return resources;
}

/**
 * Orders resources in ascending order by status precedence.
 */
export function buildStatusOrderingFunction<R extends Resource>(
  statusPrecedence?: MergeStatusPrecedence<R>
): (resources: R[]) => R[] {
  if (!statusPrecedence) {
    return defaultOrderingFunction;
  }
  const statusPrecedenceIndex = new Map(statusPrecedence.map((status, index) => [status, index]));

  return function (resources: R[]): R[] {
    return [...resources].sort((a, b) => {
      const aStatus = getStatus(a);
      if (!aStatus) return -Infinity;
      const bStatus = getStatus(b);
      if (!bStatus) return Infinity;

      const aIndex = statusPrecedenceIndex.get(aStatus);
      const bIndex = statusPrecedenceIndex.get(bStatus);
      if (aIndex === undefined || bIndex === undefined) {
        return 0;
      }
      return aIndex - bIndex;
    });
  };
}

export function getStatus<R extends Resource>(resource: R): ResourceStatus<R> | undefined {
  if (!("status" in resource)) {
    return undefined;
  }
  if (typeof resource.status !== "string") {
    return undefined;
  }
  return resource.status as ResourceStatus<R>;
}
