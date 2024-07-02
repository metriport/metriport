import fs from "fs";
import path from "path";
import { getCodeDisplay } from "./term-server-api";

function processDirectory(
  directoryPath: string,
  hashTable: { [key: string]: number },
  totalConditionCounts: { count: number }
) {
  const filesAndDirectories = fs.readdirSync(directoryPath);

  for (const name of filesAndDirectories) {
    const currentPath = path.join(directoryPath, name);
    const stat = fs.statSync(currentPath);

    if (stat.isDirectory()) {
      processDirectory(currentPath, hashTable, totalConditionCounts);
    } else if (name.endsWith(".json")) {
      processFile(currentPath, hashTable, totalConditionCounts);
    }
  }
}

function processFile(
  filePath: string,
  hashTable: { [key: string]: number },
  totalConditionCounts: { count: number }
) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (data.resourceType === "Bundle" && data.type === "batch") {
    for (const entry of data.entry) {
      if (
        entry.resource?.resourceType === "Condition" &&
        entry.resource.verificationStatus === true
      ) {
        const codeInfo = entry.resource.code;
        const code = codeInfo.coding[0].code;
        if (hashTable[code]) {
          hashTable[code] += 1;
        } else {
          hashTable[code] = 1;
        }
      }
      totalConditionCounts.count += 1;
    }
  }
}

async function main() {
  const directoryPath = process.argv[2];
  if (!directoryPath) {
    console.error("Please provide a directory path as an argument.");
    process.exit(1);
  }

  const hashTable: { [key: string]: number } = {};
  const totalConditionCount = { count: 0 };
  processDirectory(directoryPath, hashTable, totalConditionCount);

  let disorderCount = 0;
  for (const code of Object.keys(hashTable)) {
    const codeDetails = await getCodeDisplay(code, "SNOMEDCT_US");
    if (codeDetails && codeDetails.category === "disorder") {
      console.log(
        `${code} with count ${hashTable[code]} is a disorder: ${codeDetails.display} (${codeDetails.category})`
      );
      disorderCount += hashTable[code];
    }
  }

  const totalCount = Object.values(hashTable).reduce((acc, count) => acc + count, 0);

  console.log(`Total #of Conditions in the directory: ${totalConditionCount.count}`);
  console.log(`Total #of Conditions generated from <Precondition> in the directory: ${totalCount}`);
  console.log(
    `Total #of Conditions generated from <Precondition> in the directory of type disorder: ${disorderCount}`
  );
}

if (require.main === module) {
  main();
}
