import { Identifier } from "@medplum/fhirtypes";

export function mergeArrays<T>(masterArray: T[] | undefined, values: T[][]): T[] | undefined {
  const mergedArray = masterArray ? [...masterArray] : [];
  for (const value of values) {
    mergedArray.push(...value);
  }
  return mergedArray;
}

export function mergeIdentifiers(
  masterIdentifier: Identifier | undefined,
  identifiers: Identifier[]
): Identifier | undefined {
  const firstIdentifier = masterIdentifier ? masterIdentifier : identifiers[0];
  if (!firstIdentifier) return undefined;
  return firstIdentifier;
}

export function mergeIdentifierArrays(
  masterIdentifiers: Identifier[],
  resourceIdentifiers: Identifier[][]
): Identifier[] | undefined {
  const systemIdentifierMap: Record<string, Record<string, Identifier>> = {};

  for (const identifier of masterIdentifiers) {
    if (!identifier.system || !identifier.value) continue;
    let systemMap = systemIdentifierMap[identifier.system];
    if (!systemMap) {
      systemMap = systemIdentifierMap[identifier.system] = {};
    }
    systemMap[identifier.value] = identifier;
  }

  for (const identifiers of resourceIdentifiers) {
    for (const identifier of identifiers) {
      if (!identifier.system || !identifier.value) continue;
      let systemMap = systemIdentifierMap[identifier.system];
      if (!systemMap) {
        systemMap = systemIdentifierMap[identifier.system] = {};
      }
      systemMap[identifier.value] = identifier;
    }
  }
  return Object.entries(systemIdentifierMap).flatMap(([, values]) => {
    return Object.values(values);
  });
}
