import { Coverage, Organization, Practitioner, Resource } from "@medplum/fhirtypes";
import { NPI_SYSTEM } from "./constants";
import { ResourceMap, SurescriptsContext, SystemIdentifierMap } from "./types";

export function buildSharedContext(patientId: string): SurescriptsContext {
  const sharedReferences: SurescriptsContext = {
    patient: {
      resourceType: "Patient",
      id: patientId,
    },
    practitioner: {},
    pharmacy: {},
    coverage: {},
    medication: {},
  };
  return sharedReferences;
}

export function deduplicateBySystemIdentifier<R extends Practitioner | Organization | Coverage>(
  systemMap: SystemIdentifierMap<R>,
  resource?: R
): R | undefined {
  if (!resource || !resource.identifier) return undefined;

  for (const identifier of resource.identifier) {
    if (!identifier.value || !identifier.system) continue;
    let identifierMap = systemMap[identifier.system];
    if (!identifierMap) {
      systemMap[identifier.system] = identifierMap = {};
    }
    const existingResource = identifierMap[identifier.value];
    if (existingResource) {
      return existingResource;
    }
    identifierMap[identifier.value] = resource;
  }
  return undefined;
}

export function getResourceByNpiNumber<R extends Practitioner | Organization | Coverage>(
  systemMap: SystemIdentifierMap<R>,
  npiNumber: string
): R | undefined {
  if (!systemMap[NPI_SYSTEM]) return undefined;
  return systemMap[NPI_SYSTEM][npiNumber];
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
