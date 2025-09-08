import { Identifier } from "@medplum/fhirtypes";

type SystemIdentifierMap = Record<string, Record<string, Identifier>>;

export function mergeIdentifiers(
  masterIdentifier: Identifier | undefined,
  identifiers: Identifier[]
): Identifier | undefined {
  const firstIdentifier = masterIdentifier ? masterIdentifier : identifiers[0];
  if (!firstIdentifier) return undefined;
  return firstIdentifier;
}

export function mergeIdentifierArrays(
  masterIdentifiers: Identifier[] | undefined,
  resourceIdentifiers: Identifier[][]
): Identifier[] | undefined {
  const systemIdentifierMap: SystemIdentifierMap = {};

  if (masterIdentifiers) {
    addIdentifiersToSystemIdentifierMap(systemIdentifierMap, masterIdentifiers);
  }

  resourceIdentifiers.forEach(identifiers => {
    addIdentifiersToSystemIdentifierMap(systemIdentifierMap, identifiers);
  });

  return Object.values(systemIdentifierMap).flatMap(identifierMap => {
    return Object.values(identifierMap);
  });
}

function addIdentifiersToSystemIdentifierMap(
  systemIdentifierMap: SystemIdentifierMap,
  identifiers: Identifier[]
): void {
  for (const identifier of identifiers) {
    if (!identifier.system || !identifier.value) continue;
    let systemMap = systemIdentifierMap[identifier.system];
    if (!systemMap) {
      systemMap = systemIdentifierMap[identifier.system] = {};
    }
    systemMap[identifier.value] = identifier;
  }
}
