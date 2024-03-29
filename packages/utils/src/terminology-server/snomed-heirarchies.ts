import { getCodeDetailsFull } from "./term-server-api";

export type SnomedHierarchyTableEntry = {
  found: boolean;
  children: Set<string>;
  parents: Set<string>;
  root: boolean;
  inserted: boolean;
  resourceId?: string;
};

async function populateChildrenRecursively(
  hashTable: Record<string, SnomedHierarchyTableEntry>,
  childCode: string,
  parentCode: string
): Promise<void> {
  if (!hashTable[childCode]) {
    hashTable[childCode] = {
      found: false,
      children: new Set(),
      parents: new Set(),
      root: false,
      inserted: false,
    };
    hashTable[childCode].parents.add(parentCode);
    hashTable[parentCode].children.add(childCode);

    const codeDetails = await getCodeDetailsFull(childCode, "SNOMEDCT_US");
    if (codeDetails) {
      const childPromises: Promise<void>[] = [];
      codeDetails.parameter.forEach(param => {
        if (param.name === "property") {
          const valuePart = param.part.find(part => part.name === "value");
          const value = valuePart?.valueCode || valuePart?.value;

          const codePart = param.part.find(part => part.name === "code");
          const code = codePart?.valueCode || codePart?.value;

          if (value && !code) {
            childPromises.push(populateChildrenRecursively(hashTable, value, childCode));
          }
        }
      });

      await Promise.all(childPromises);
    }
  } else {
    // this is either a code
    if (hashTable[childCode].found) {
      console.log(`Downgrading ${childCode} to non-root (child)`);
      hashTable[childCode] = { ...hashTable[childCode], root: false };
      hashTable[childCode].parents.add(parentCode);
      hashTable[parentCode].children.add(childCode);
    }
  }
}

export async function populateHashTableFromCodeDetails(
  hashTable: Record<string, SnomedHierarchyTableEntry>,
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
      resourceId,
    };
  }

  const codeDetails = await getCodeDetailsFull(queriedCode, "SNOMEDCT_US");
  if (codeDetails) {
    hashTable[queriedCode] = {
      ...hashTable[queriedCode],
      found: true, // original querried code. found is true.
      resourceId,
    };

    const childPromises: Promise<void>[] = [];
    codeDetails.parameter.forEach(param => {
      if (param.name === "property") {
        const valuePart = param.part.find(part => part.name === "value");
        const value = valuePart?.valueCode || valuePart?.value;
        const codePart = param.part.find(part => part.name === "code");
        const code = codePart?.valueCode || codePart?.value;

        // !code means the code is a child
        if (value && !code) {
          childPromises.push(populateChildrenRecursively(hashTable, value, queriedCode));
        }
      }
    });

    await Promise.all(childPromises);
  }

  return hashTable;
}
