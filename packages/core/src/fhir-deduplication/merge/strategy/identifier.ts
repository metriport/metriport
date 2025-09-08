import { Identifier } from "@medplum/fhirtypes";

type SystemIdentifierMap = Record<string, Record<string, Identifier>>;

/**
 * Merges arrays of identifiers into a single array of identifiers, and removes duplicate identifiers
 * with the same (system, value) pair.
 * @param masterIdentifiers - the identifier array on the master resource
 * @param resourceIdentifiers - additional identifier arrays on other equal resources
 * @returns the merged identifier array
 */
export function mergeIdentifierArrays(
  masterIdentifiers: Identifier[] | undefined,
  resourceIdentifiers: Identifier[][]
): Identifier[] | undefined {
  const systemIdentifierMap: SystemIdentifierMap = {};
  addIdentifiersToSystemIdentifierMap(systemIdentifierMap, masterIdentifiers);
  for (const identifiers of resourceIdentifiers) {
    addIdentifiersToSystemIdentifierMap(systemIdentifierMap, identifiers);
  }

  return Object.values(systemIdentifierMap).flatMap(identifierMap => {
    return Object.values(identifierMap);
  });
}

/**
 * Adds Identifier objects to a system identifier map, which is a map of system -> value -> identifier.
 */
function addIdentifiersToSystemIdentifierMap(
  systemIdentifierMap: SystemIdentifierMap,
  identifiers?: Identifier[]
): void {
  if (!identifiers) return;
  for (const identifier of identifiers) {
    if (!identifier.system || !identifier.value) continue;
    let systemMap = systemIdentifierMap[identifier.system];
    if (!systemMap) {
      systemMap = systemIdentifierMap[identifier.system] = {};
    }
    systemMap[identifier.value] = identifier;
  }
}
