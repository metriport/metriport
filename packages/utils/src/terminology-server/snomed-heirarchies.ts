import { CodeDetailsResponse } from "./term-server-api";

export type SnomedHierarchyTableEntry = {
  found: boolean;
  children: Set<string>;
  parents: Set<string>;
  root: boolean;
  inserted: boolean;
  resourceId?: string;
};

export async function populateHashTableFromCodeDetails(
  hashTable: Record<string, SnomedHierarchyTableEntry>,
  codeDetails: CodeDetailsResponse,
  queriedCode: string,
  resourceId: string
): Promise<Record<string, SnomedHierarchyTableEntry>> {
  if (!hashTable[queriedCode]) {
    hashTable[queriedCode] = {
      found: true,
      children: new Set(),
      parents: new Set(),
      root: true,
      inserted: false,
      resourceId: resourceId,
    };
    // set a node that was previously an unfound child to be found
  } else {
    console.log(`Downgrading ${queriedCode} to non-root (current)`);
    hashTable[queriedCode] = { ...hashTable[queriedCode], found: true, resourceId: resourceId };
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
            children: new Set(),
            parents: new Set(),
            root: false,
            inserted: false,
          };
        } else {
          // this is either a code
          if (hashTable[value].found) {
            console.log(`Downgrading ${value} to non-root (child)`);
            hashTable[value] = { ...hashTable[value], root: false };
          }
        }
        hashTable[value].parents.add(queriedCode);
        hashTable[queriedCode].children.add(value);
      }
    }
  });

  return hashTable;
}
