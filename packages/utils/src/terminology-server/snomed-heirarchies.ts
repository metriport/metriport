export type HashTableEntry = {
  found: boolean;
  children: Set<string>;
  parents: Set<string>;
  root: boolean;
  inserted: boolean;
};

export type CodeDetailsResponse = {
  parameter: {
    name: string;
    part: [
      {
        name: string;
        value?: string;
        valueCode?: string;
      }
    ];
  }[];
};

export async function populateHashTableFromCodeDetails(
  hashTable: Record<string, HashTableEntry>,
  codeDetails: CodeDetailsResponse,
  queriedCode: string
): Promise<Record<string, HashTableEntry>> {
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

export function prettyPrintHashTable(hashTable: Record<string, HashTableEntry>): void {
  const entries = Object.entries(hashTable);

  const header = ["Code", "Found", "Root"];
  const separator = header.map(() => "---");

  const rows = entries.map(([code, entry]) => {
    const { found, root } = entry;
    const foundStr = found ? "✓" : "✗";
    const rootStr = root ? "✓" : "✗";
    return [code, foundStr, rootStr];
  });

  // Calculate the maximum width for each column
  const columnWidths = header.map((_, colIndex) =>
    Math.max(...rows.map(row => row[colIndex].length), header[colIndex].length)
  );

  // Print the table
  const printRow = (row: string[]) =>
    console.log(
      "| " + row.map((cell, colIndex) => cell.padEnd(columnWidths[colIndex])).join(" | ") + " |"
    );
  printRow(header);
  printRow(separator);
  rows.forEach(row => printRow(row));
}
