import { Reference, Resource } from "@medplum/fhirtypes";

export function makeReference<T extends Resource>(res: T): Reference<T> {
  return {
    reference: res.resourceType + "/" + res.id,
    type: res.resourceType,
  };
}

export function makeIdReference<T extends Resource>(res: T): Reference<T> {
  return {
    ...(res.id ? { id: res.id } : {}),
    type: res.resourceType,
  };
}

export function makeUrnUuidReference<T extends Resource>(res: T): Reference<T> {
  return {
    reference: "urn:uuid:" + res.id,
    type: res.resourceType,
  };
}

export function makeUrlReference<T extends Resource>(res: T): Reference<T> {
  return {
    reference: `https://fhir.metriport.com/${res.resourceType}/${res.id}`,
    type: res.resourceType,
  };
}
