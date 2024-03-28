import { CodeDetailsResponse } from "./term-server-api";

export type SnomedHierarchyTableEntry = {
  found: boolean;
  parents: Set<string>;
  root: boolean;
  inserted: boolean;
  resourceId?: string;
};

export async function populateHashTableFromCodeDetails(
  hashTable: Record<string, SnomedHierarchyTableEntry>,
  conditionIdsDictionary: Record<string, Set<string>>,
  codeDetails: CodeDetailsResponse,
  queriedCode: string,
  resourceId: string
): Promise<Record<string, SnomedHierarchyTableEntry>> {
  if (!hashTable[queriedCode]) {
    hashTable[queriedCode] = {
      found: true,
      parents: new Set(),
      root: true,
      inserted: false,
      resourceId: resourceId,
    };
    // set a node that was previously an unfound child to be found
  } else {
    console.log(`Downgrading ${queriedCode} to non-root (current)`);
    hashTable[queriedCode] = { ...hashTable[queriedCode], found: true, resourceId: resourceId };
    // children Ids point to parent
    conditionIdsDictionary[resourceId] = new Set(
      Array.from(hashTable[queriedCode].parents)
        .map(parentCode => hashTable[parentCode]?.resourceId)
        .filter((id): id is string => id !== undefined)
    );
  }
  codeDetails.parameter.forEach(param => {
    if (param.name === "property") {
      const valuePart = param.part.find(part => part.name === "value");
      const value = valuePart?.valueCode || valuePart?.value;

      const codePart = param.part.find(part => part.name === "code");
      const code = codePart?.valueCode || codePart?.value;

      // downgrade all children
      if (value && !code) {
        if (!hashTable[value]) {
          hashTable[value] = {
            found: false,
            parents: new Set(),
            root: false,
            inserted: false,
          };
        } else {
          hashTable[value] = { ...hashTable[value], root: false };
          const resourceId = hashTable[value].resourceId;
          if (resourceId) {
            console.log(`Downgrading ${value} to non-root (existing)`);
            if (!conditionIdsDictionary[resourceId]) {
              const queriedResourceId = hashTable[queriedCode].resourceId;
              if (queriedResourceId) {
                conditionIdsDictionary[resourceId] = new Set([queriedResourceId]);
              } else {
                conditionIdsDictionary[resourceId] = new Set();
              }
            } else {
              const queriedResourceId = hashTable[queriedCode].resourceId;
              if (queriedResourceId) {
                conditionIdsDictionary[resourceId].add(queriedResourceId);
              }
            }
          }
        }
        hashTable[value].parents.add(queriedCode);
      }
    }
  });

  return hashTable;
}
