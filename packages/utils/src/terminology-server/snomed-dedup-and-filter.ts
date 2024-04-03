import fs from "fs";
import path from "path";
import { getCodeDisplay, getCodeDetailsFull } from "./term-server-api";
import { populateHashTableFromCodeDetails, SnomedHierarchyTableEntry } from "./snomed-heirarchies";
import { RemovalStats, createInitialRemovalStats, prettyPrintRemovalStats } from "./stats";

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
            await populateHashTableFromCodeDetails(hashTable, coding.code, resource.id);
          }
        }
      }
    }
  }
}

async function removeNonRootSnomedCodes(
  filePath: string,
  hashTable: Record<string, SnomedHierarchyTableEntry>,
  conditionIdsDictionary: Set<string>,
  allRemainingEnries: Set<string>,
  removalStats: RemovalStats
) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const entries = data.bundle ? data.bundle.entry : data.entry;

  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    const resource = entry.resource;
    if (resource && resource.resourceType === "Condition") {
      conditionIdsDictionary.add(resource.id);
      const codings = resource.code?.coding || [];
      for (const coding of codings) {
        if (coding.system === "http://snomed.info/sct") {
          if (hashTable[coding.code] && !hashTable[coding.code].root) {
            removalStats.nonSnomedRootCodes.count += 1;
            removalStats.nonSnomedRootCodes.codes.add(coding.code);
            console.log("Removing non-root SNOMED code:", coding.code, "Resource.id:", resource.id);
            entries.splice(i, 1);
            break;
          } else {
            hashTable[coding.code].inserted = true;
            allRemainingEnries.add(resource.id);
            break;
          }
        }
      }
    }
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function removeConditionsProceduresMedAdmins(
  filePath: string,
  conditionSet: Set<string>,
  cptSet: Set<string>,
  medicationConditionDict: Record<string, string>,
  allRemainingEnries: Set<string>,
  removalStats: RemovalStats
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
          if (conditionSet.has(coding.code)) {
            removalStats.duplicateCodes.count += 1;
            removalStats.duplicateCodes.codes.add(coding.code);
            break;
          } else {
            conditionSet.add(coding.code);
            const codeDetails = await getCodeDisplay(coding.code, "SNOMEDCT_US");
            if (codeDetails && codeDetails.category === "disorder") {
              hasSnomedCode = true;
              const updatedText = `${codeDetails.display} (${codeDetails.category})`;
              resource.code.text = updatedText;
              coding.text = updatedText;
              break;
            } else {
              removalStats.nonDisorderCodes.count += 1;
              removalStats.nonDisorderCodes.codes.add(coding.code);
              break;
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
            if (cptSet.has(coding.code)) {
              removalStats.duplicateCptCodes.count += 1;
              removalStats.duplicateCptCodes.codes.add(coding.code);
              break;
            } else {
              hasValidCptCode = true;
              console.log(
                "Keeping CPT code:",
                coding.code,
                "Resource.id:",
                resource.id,
                "hasValidCptCode:",
                hasValidCptCode
              );
              cptSet.add(coding.code);
              allRemainingEnries.add(resource.id);
              break;
            }
          } else {
            removalStats.invalidCptCodes.count += 1;
            removalStats.invalidCptCodes.codes.add(coding.code);
            break;
          }
        }
      }
      if (!hasValidCptCode) {
        removalStats.entriesWithoutCptCodes.count += 1;
        entries.splice(i, 1);
      }
    } else if (resource && resource.resourceType === "MedicationAdministration") {
      if (resource.reasonReference) {
        const medicationRef = resource.medicationReference?.reference.split("/")[1];
        const conditionRef = resource.reasonReference[0]?.reference.split("/")[1];

        if (medicationRef && conditionRef) {
          medicationConditionDict[medicationRef] = conditionRef;
          allRemainingEnries.add(resource.id);
        }
      } else {
        console.log("Removing MedicationAdministration entry without condition reference");
        entries.splice(i, 1);
      }
    }
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function filterMedicationsEntries(
  filePath: string,
  conditionIdsDictionary: Set<string>,
  medicationConditionDict: Record<string, string>,
  rxNormSet: Set<string>,
  removalStats: RemovalStats
) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const entries = data.bundle ? data.bundle.entry : data.entry;

  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    const resource = entry.resource;
    if (resource && resource.resourceType === "Medication") {
      const conditionRef = medicationConditionDict[resource.id];

      // if the medication is linked to a conditon that is a non-duplicate disorder
      if (conditionIdsDictionary.has(conditionRef)) {
        const codings = resource.code?.coding || [];
        for (const coding of codings) {
          if (coding.system === "http://www.nlm.nih.gov/research/umls/rxnorm") {
            if (rxNormSet.has(coding.code)) {
              removalStats.rxnormDuplicates.count += 1;
              removalStats.rxnormDuplicates.codes.add(coding.code);
              entries.splice(i, 1);
            } else {
              rxNormSet.add(coding.code);
              console.log(
                "Keeping Medication. RXNORM code:",
                coding.code,
                "linked to condition:",
                conditionRef,
                "Resource.id:",
                resource.id
              );
            }
          }
        }
      } else {
        removalStats.nonConditionLinkedMedications.count += 1;
        entries.splice(i, 1);
      }
    }
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

export async function fullProcessing(directoryPath: string) {
  const removalStats = createInitialRemovalStats();

  // Removal of non-disorder SNOMED codes, invalid CPT codes, and duplicate CPT codes
  const cptSet = new Set<string>();
  const conditionsSet = new Set<string>();
  const allRemainingEnries = new Set<string>();
  const medicationConditionDict: Record<string, string> = {};
  await processDirectoryOrFile(directoryPath, async filePath => {
    await removeConditionsProceduresMedAdmins(
      filePath,
      conditionsSet,
      cptSet,
      medicationConditionDict,
      allRemainingEnries,
      removalStats
    );
  });

  prettyPrintRemovalStats(removalStats);

  // Create hierarchy of SNOMED codes
  const hashTable: Record<string, SnomedHierarchyTableEntry> = {};
  await processDirectoryOrFile(directoryPath, async filePath => {
    await computeHashTable(filePath, hashTable);
  });

  // Remove non-root SNOMED codes
  const conditionIdsDictionary = new Set<string>();
  await processDirectoryOrFile(directoryPath, async filePath => {
    await removeNonRootSnomedCodes(
      filePath,
      hashTable,
      allRemainingEnries,
      conditionIdsDictionary,
      removalStats
    );
  });

  console.log("conditionIdsDictionary", conditionIdsDictionary);
  console.log("medicationConditionDict", medicationConditionDict);

  // Removal of duplicate RXNORM codes and medications without condition reference
  const rxNormSet = new Set<string>();
  await processDirectoryOrFile(directoryPath, async filePath => {
    await filterMedicationsEntries(
      filePath,
      conditionIdsDictionary,
      medicationConditionDict,
      rxNormSet,
      removalStats
    );
  });

  prettyPrintRemovalStats(removalStats);
}

async function main() {
  const [directoryPath] = process.argv.slice(2);
  if (!directoryPath) {
    console.error("Please provide a directory path as an argument.");
    process.exit(1);
  }
  await fullProcessing(directoryPath);
}

if (require.main === module) {
  main();
}
