import {
  Condition,
  Coverage,
  Extension,
  Medication,
  Organization,
  Practitioner,
  Resource,
} from "@medplum/fhirtypes";
import { dataSourceExtensionDefaults } from "../../fhir/shared/extensions/extension";
import { NPI_URL } from "./constants";
import { ResourceMap, SurescriptsContext, SystemIdentifierMap } from "./types";

export function initializeContext(patientId: string): SurescriptsContext {
  const context: SurescriptsContext = {
    patient: {
      resourceType: "Patient",
      id: patientId,
    },
    practitioner: {},
    pharmacy: {},
    coverage: {},
    insuranceOrganization: {},
    medication: {},
    condition: {},
  };
  return context;
}

export function deduplicateBySystemIdentifier<R extends Practitioner | Organization | Coverage>(
  systemMap: SystemIdentifierMap<R>,
  resource?: R
): R | undefined {
  if (!resource || !resource.identifier) return undefined;
  let masterResource: R = resource;

  for (const identifier of resource.identifier) {
    if (!identifier.value || !identifier.system) continue;
    let identifierMap = systemMap[identifier.system];
    if (!identifierMap) {
      systemMap[identifier.system] = identifierMap = {};
    }
    const existingResource = identifierMap[identifier.value];
    if (existingResource) {
      masterResource = existingResource;
    }
    identifierMap[identifier.value] = resource;
  }
  return masterResource;
}

export function deduplicateByCoding<R extends Medication | Condition>(
  systemMap: SystemIdentifierMap<R>,
  resource?: R
): R | undefined {
  if (!resource || !resource.code || !resource.code.coding) return resource;
  let masterResource: R = resource;

  for (const coding of resource.code.coding) {
    if (!coding.system || !coding.code) continue;
    let codingMap = systemMap[coding.system];
    if (!codingMap) {
      systemMap[coding.system] = codingMap = {};
    }
    const existingResource = codingMap[coding.code];
    if (existingResource) {
      masterResource = existingResource;
    }
    codingMap[coding.code] = resource;
  }
  return masterResource;
}

export function deduplicateByKey<R extends Resource, K extends keyof R>(
  resourceMap: ResourceMap<R>,
  key: K,
  resource?: R
): R | undefined {
  if (!resource) return undefined;

  const resourceValue = resource[key] as keyof ResourceMap<R> | undefined;
  if (!resourceValue) return resource;

  const existingResource = resourceMap[resourceValue];
  if (existingResource) {
    return existingResource;
  }
  resourceMap[resourceValue] = resource;
  return resource;
}

export function getResourceByNpiNumber<R extends Practitioner | Organization | Coverage>(
  systemMap: SystemIdentifierMap<R>,
  npiNumber: string
): R | undefined {
  if (!systemMap[NPI_URL]) return undefined;
  return systemMap[NPI_URL][npiNumber];
}

export function getSurescriptsDataSourceExtension(): Extension {
  return {
    ...dataSourceExtensionDefaults,
    valueCoding: {
      ...dataSourceExtensionDefaults.valueCoding,
      code: "SURESCRIPTS",
    },
  };
}
