import { Resource } from "@medplum/fhirtypes";

function defaultOrderingFunction<R extends Resource>(resources: R[]): R[] {
  return resources;
}

export function buildStatusOrderingFunction<R extends Resource>(
  statusPrecedence?: string[]
): (resources: R[]) => R[] {
  if (!statusPrecedence) {
    return defaultOrderingFunction;
  }
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

export function getStatus(resource: Resource): string | undefined {
  if (!("status" in resource)) {
    return undefined;
  }
  if (typeof resource.status !== "string") {
    return undefined;
  }
  return resource.status;
}
