import { Reference, Resource } from "@medplum/fhirtypes";

export function makeReferece<T extends Resource>(res: T): Reference<T> {
  return {
    reference: res.resourceType + "/" + res.id,
    type: res.resourceType,
  };
}
