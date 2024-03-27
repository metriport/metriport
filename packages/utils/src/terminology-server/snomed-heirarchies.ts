import { CodeDetailsResponse } from "./term-server-api";

export type SnomedHierarchyTableEntry = {
  found: boolean;
  children: Set<string>;
  parents: Set<string>;
  root: boolean;
  inserted: boolean;
};

export async function populateHashTableFromCodeDetails(
  hashTable: Record<string, SnomedHierarchyTableEntry>,
  codeDetails: CodeDetailsResponse,
  queriedCode: string
): Promise<Record<string, SnomedHierarchyTableEntry>> {
  if (hashTable[queriedCode] && !hashTable[queriedCode].found) {
    // if we found a parent node, make it the root and its children non-root
    if (hashTable[queriedCode].parents.size == 0) {
      console.log(
        `Updating root node to ${queriedCode}, hashTable[queriedCode].children:`,
        hashTable[queriedCode].children
      );
      hashTable[queriedCode] = { ...hashTable[queriedCode], found: true, root: true };
      for (const child of hashTable[queriedCode].children) {
        hashTable[child].root = false;
      }
    }
    // if we found a child node, do nothing since it already has a parent which is found and higher
    else {
      console.log(
        `Updating root node for ${queriedCode}, hashTable[queriedCode].parents:`,
        hashTable[queriedCode].parents
      );
      hashTable[queriedCode] = { ...hashTable[queriedCode], found: true, root: false };
    }
  } else {
    hashTable[queriedCode] = {
      found: true,
      parents: new Set(),
      children: new Set(),
      root: true,
      inserted: false,
    };
    codeDetails.parameter.forEach(param => {
      if (param.name === "property") {
        const valuePart = param.part.find(part => part.name === "value");
        const value = valuePart?.valueCode || valuePart?.value;

        const codePart = param.part.find(part => part.name === "code");
        const code = codePart?.valueCode || codePart?.value;

        // parents
        if (value && code === "parent") {
          if (!hashTable[value]) {
            hashTable[value] = {
              found: false,
              parents: new Set(),
              children: new Set(),
              root: false,
              inserted: false,
            };
            hashTable[queriedCode].parents.add(value);
            // having children indicates your a parent node
            hashTable[value].children.add(queriedCode);
          }
        }
        // children
        else if (value && !code) {
          if (!hashTable[value]) {
            hashTable[value] = {
              found: false,
              parents: new Set(),
              children: new Set(),
              root: false,
              inserted: false,
            };
            hashTable[queriedCode].children.add(value);
            // having parents indicates your a chilld node
            hashTable[value].parents.add(queriedCode);
          }
        }
      }
    });
  }
  return hashTable;
}
