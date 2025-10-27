import { Resource } from "@medplum/fhirtypes";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";

export function createResource<T extends Resource>(resourceType: T["resourceType"]): T {
  return {
    resourceType,
    id: uuidv7(),
  } as T;
}
