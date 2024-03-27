import { SnomedHierarchyTableEntry } from "./snomed-heirarchies";

export type RemovalStats = {
  duplicateCodes: { count: number; codes: Set<string> };
  nonSnomedRootCodes: { count: number; codes: Set<string> };
  nonDisorderCodes: { count: number; codes: Set<string> };
  entriesWithoutSnomedCodes: { count: number; codes: Set<string> };
  invalidCptCodes: { count: number; codes: Set<string> };
  entriesWithoutCptCodes: { count: number; codes: Set<string> };
  duplicateCptCodes: { count: number; codes: Set<string> };
  rxnormDuplicates: { count: number; codes: Set<string> };
};

export function prettyPrintHashTable(hashTable: Record<string, SnomedHierarchyTableEntry>): void {
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

export function createInitialRemovalStats(): RemovalStats {
  return {
    duplicateCodes: { count: 0, codes: new Set<string>() },
    nonSnomedRootCodes: { count: 0, codes: new Set<string>() },
    nonDisorderCodes: { count: 0, codes: new Set<string>() },
    entriesWithoutSnomedCodes: { count: 0, codes: new Set<string>() },
    invalidCptCodes: { count: 0, codes: new Set<string>() },
    entriesWithoutCptCodes: { count: 0, codes: new Set<string>() },
    duplicateCptCodes: { count: 0, codes: new Set<string>() },
    rxnormDuplicates: { count: 0, codes: new Set<string>() },
  };
}

export function prettyPrintRemovalStats(removalStats: RemovalStats): void {
  console.log("\nRemoval Stats Summary:\n");
  const headers = ["Reason", "Count", "Example Codes (up to 5)"];

  let maxReasonLength = headers[0].length;
  let maxCountLength = headers[1].length;
  let maxExampleCodesLength = headers[2].length;

  const dataRows = Object.entries(removalStats).map(([reason, { count, codes }]) => {
    const exampleCodes = Array.from(codes).slice(0, 5).join(", ") + (codes.size > 5 ? ", ..." : "");
    maxReasonLength = Math.max(maxReasonLength, reason.length);
    maxCountLength = Math.max(maxCountLength, count.toString().length);
    maxExampleCodesLength = Math.max(maxExampleCodesLength, exampleCodes.length);
    return [reason, count.toString(), exampleCodes];
  });

  console.log(
    `${headers[0].padEnd(maxReasonLength)} | ${headers[1].padEnd(
      maxCountLength
    )} | ${headers[2].padEnd(maxExampleCodesLength)}`
  );
  console.log("-".repeat(maxReasonLength + maxCountLength + maxExampleCodesLength + 6)); // 6 for padding and separators

  dataRows.forEach(([reason, count, exampleCodes]) => {
    console.log(
      `${reason.padEnd(maxReasonLength)} | ${count.padEnd(maxCountLength)} | ${exampleCodes.padEnd(
        maxExampleCodesLength
      )}`
    );
  });
}
