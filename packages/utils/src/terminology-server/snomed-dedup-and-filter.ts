import fs from "fs";
import path from "path";
import { getCodeDisplay, getCodeDetailsFull } from "./term-server-api";
import { populateHashTableFromCodeDetails, SnomedHierarchyTableEntry } from "./snomed-heirarchies";
import {
  prettyPrintHashTable,
  RemovalStats,
  createInitialRemovalStats,
  prettyPrintRemovalStats,
} from "./stats";

async function processDirectoryOrFile(
  directoryOrFile: string,
  processFile: (filePath: string) => Promise<void>
) {
  const stat = fs.statSync(directoryOrFile);
  if (stat.isFile()) {
    if (directoryOrFile.endsWith(".json")) {
      await processFile(directoryOrFile);
    }
    return;
  }

  const items = fs.readdirSync(directoryOrFile, { withFileTypes: true });
  for (const item of items) {
    const sourcePath = path.join(directoryOrFile, item.name);
    if (item.isDirectory()) {
      await processDirectoryOrFile(sourcePath, processFile);
    } else if (item.isFile() && item.name.endsWith(".json")) {
      await processFile(sourcePath);
    }
  }
}

async function computeHashTable(
  filePath: string,
  hashTable: Record<string, SnomedHierarchyTableEntry>
) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const entries = data.bundle ? data.bundle.entry : data.entry;

  for (const entry of entries) {
    const resource = entry.resource;
    if (resource && resource.resourceType === "Condition") {
      const codings = resource.code?.coding || [];
      for (const coding of codings) {
        if (coding.system === "http://snomed.info/sct") {
          const codeDetails = await getCodeDetailsFull(coding.code, "SNOMEDCT_US");
          if (codeDetails) {
            await populateHashTableFromCodeDetails(hashTable, codeDetails, coding.code);
          }
        }
      }
    }
  }
}

async function processFileEntries(
  filePath: string,
  hashTable: Record<string, SnomedHierarchyTableEntry>,
  removalStats: RemovalStats,
  rxNormSet: Set<string>,
  cptSet: Set<string>
) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const entries = data.bundle ? data.bundle.entry : data.entry;

  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    const resource = entry.resource;
    if (resource && resource.resourceType === "Condition") {
      const codings = resource.code?.coding || [];
      let hasSnomedCode = false;

      for (const coding of codings) {
        if (coding.system === "http://snomed.info/sct") {
          hasSnomedCode = true;
          if (hashTable[coding.code] && hashTable[coding.code].inserted) {
            removalStats.duplicateCodes.count += 1;
            removalStats.duplicateCodes.codes.add(coding.code);
            entries.splice(i, 1);
            break;
          } else if (hashTable[coding.code] && !hashTable[coding.code].root) {
            removalStats.nonSnomedRootCodes.count += 1;
            removalStats.nonSnomedRootCodes.codes.add(coding.code);
            entries.splice(i, 1);
            break;
          } else {
            hashTable[coding.code].inserted = true;
            const codeDetails = await getCodeDisplay(coding.code, "SNOMEDCT_US");
            if (codeDetails) {
              if (codeDetails.category !== "disorder") {
                removalStats.nonDisorderCodes.count += 1;
                removalStats.nonDisorderCodes.codes.add(coding.code);
                entries.splice(i, 1);
                break;
              } else {
                const updatedText = `${codeDetails.display} (${codeDetails.category})`;
                resource.code.text = updatedText;
                coding.text = updatedText;
              }
            }
          }
        }
      }
      if (!hasSnomedCode) {
        removalStats.entriesWithoutSnomedCodes.count += 1;
        entries.splice(i, 1);
      }
    } else if (resource && resource.resourceType === "Procedure") {
      const codings = resource.code?.coding || [];
      let hasValidCptCode = false;

      for (const coding of codings) {
        if (coding.system === "http://www.ama-assn.org/go/cpt") {
          const cptCode = parseInt(coding.code, 10);
          if (cptCode >= 10004 && cptCode <= 69990) {
            hasValidCptCode = true;
            if (cptSet.has(coding.code)) {
              removalStats.duplicateCptCodes.count += 1;
              removalStats.duplicateCptCodes.codes.add(coding.code);
              entries.splice(i, 1);
            } else {
              cptSet.add(coding.code);
            }
            break;
          } else {
            removalStats.invalidCptCodes.count += 1;
            removalStats.invalidCptCodes.codes.add(coding.code);
            entries.splice(i, 1);
            break;
          }
        }
      }
      if (!hasValidCptCode) {
        removalStats.entriesWithoutCptCodes.count += 1;
        entries.splice(i, 1);
      }
    } else if (resource && resource.resourceType === "Medication") {
      const codings = resource.code?.coding || [];
      for (const coding of codings) {
        if (coding.system === "http://www.nlm.nih.gov/research/umls/rxnorm") {
          if (rxNormSet.has(coding.code)) {
            entries.splice(i, 1);
            removalStats.rxnormDuplicates.count += 1;
            removalStats.rxnormDuplicates.codes.add(coding.code);
            break;
          } else {
            rxNormSet.add(coding.code);
          }
        }
      }
    }
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function main() {
  const [directoryPath] = process.argv.slice(2);
  if (!directoryPath) {
    console.error("Please provide a directory path as an argument.");
    process.exit(1);
  }
  const hashTable: Record<string, SnomedHierarchyTableEntry> = {};

  await processDirectoryOrFile(directoryPath, async filePath => {
    await computeHashTable(filePath, hashTable);
  });

  prettyPrintHashTable(hashTable);
  const removalStats = createInitialRemovalStats();

  const rxNormSet = new Set<string>();
  const cptSet = new Set<string>();
  await processDirectoryOrFile(directoryPath, async filePath => {
    await processFileEntries(filePath, hashTable, removalStats, rxNormSet, cptSet);
  });

  prettyPrintRemovalStats(removalStats);
}

main();
