import csv from "csv-parser";
import fs from "fs";
import { mapHeadersForCsvParser } from "./shared";

/**
 * Finds duplicate IDs in a CSV file where IDs are in the first column
 *
 * Usage:
 * - set the inputFilePath
 * - run the script
 *   > ts-node src/csv/find-dups.ts
 */

const inputFilePath = "";

async function findDuplicateIds() {
  const idCounts = new Map<string, number>();
  const duplicates: string[] = [];

  fs.createReadStream(inputFilePath)
    .pipe(csv({ mapHeaders: mapHeadersForCsvParser }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .on("data", async (data: any) => {
      const id = data.patientid;
      if (id == undefined) return;

      const currentCount = idCounts.get(id) ?? 0;

      if (currentCount === 1) {
        duplicates.push(id);
      }

      idCounts.set(id, currentCount + 1);
    })
    .on("end", async () => {
      console.log(`Processed ${idCounts.size} IDs`);
      console.log(`Found ${duplicates.length} duplicate IDs:`);
      duplicates.forEach(id => {
        console.log(id);
      });
      console.log(`Done.`);
    });
}

if (require.main === module) {
  findDuplicateIds();
}
