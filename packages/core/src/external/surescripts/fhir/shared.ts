import { Coverage, Organization, Practitioner, Resource } from "@medplum/fhirtypes";
import { ResourceMap, SurescriptsConverterContext, SystemIdentifierMap } from "./types";

export function buildSharedContext(): SurescriptsConverterContext {
  const sharedReferences: SurescriptsConverterContext = {
    patient: undefined,
    practitioner: {},
    pharmacy: {},
    coverage: {},
    medication: {},
  };
  return sharedReferences;
}

export function getResourceFromSystemIdentifierMap<
  R extends Practitioner | Organization | Coverage
>(systemIdentifierMap: SystemIdentifierMap<R>, resource?: R): R | undefined {
  if (!resource || !resource.identifier) return undefined;

  for (const identifier of resource.identifier) {
    if (!identifier.value || !identifier.system) continue;
    let identifierMap = systemIdentifierMap[identifier.system];
    if (!identifierMap) {
      systemIdentifierMap[identifier.system] = identifierMap = {};
    }
    const existingResource = identifierMap[identifier.value];
    if (existingResource) {
      return existingResource;
    }
    identifierMap[identifier.value] = resource;
  }
  return resource;
}

export function getResourceFromResourceMap<R extends Resource>(
  resourceMap: ResourceMap<R>,
  resourceKeys: (keyof R)[],
  resource?: R
): R | undefined {
  if (!resource) return undefined;

  for (const key of resourceKeys) {
    const resourceValue = resource[key];
    if (resourceValue != null && resourceValue === resourceMap[key]) {
      return resourceMap[key];
    }
    resourceMap[key] = resource;
  }
  return resource;
}
