/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Base64Scrambler } from "@metriport/core/util/base64-scrambler";
import dotenv from "dotenv";
import csv from "csv-parser";
import fs from "fs";
import { unpackUuid } from "@metriport/core/util/pack-uuid";
import { Config } from "@metriport/core/util/config";

dotenv.config();

const scrambler = new Base64Scrambler(Config.getHl7Base64ScramblerSeed());

/**
 * This script unpacks the identifier column for a generated patient roster. This is helpful for debugging roster uploads.
 *
 * Usage:
 * 1. Set the HL7_BASE64_SCRAMBLER_SEED environment variable to the same value as the one used by the roster upload script.
 * 2. Run the script with the path to the roster CSV file as the argument.
 *    ```
 *    npx ts-node unpack-patient-roster-identifier.ts ~/Documents/PHI/patients_2025-05-31.csv
 *    ```
 * 3. The script will output the new CSV data to the console..
 */
const fileName = process.argv[2];
const identifierColumnName = "IDENTIFIER";

async function main() {
  const rows: Array<object> = [];
  fs.createReadStream(fileName)
    .pipe(csv())
    .on("data", data => {
      const { [identifierColumnName]: identifier, ...rest } = data;
      if (!identifier) {
        console.log(
          `No identifier column found using name ${identifierColumnName} for row ${JSON.stringify(
            data
          )}`
        );
        return;
      }

      const [cxId, patientId] = processIdentifier(identifier);
      rows.push({ [identifierColumnName]: identifier, cxId, patientId, ...rest });
      if (rows.length > 10) {
        console.log(`Processed ${rows.length} rows:`);
        console.log(rows);
        process.exit(0);
      }
    })
    .on("end", () => {
      console.log("Done processing identifiers");
    });
}

main().catch(error => {
  console.error("Error:", error);
  process.exit(1);
});

function processIdentifier(identifier: string): [string, string] {
  return identifier.split("_").map(v => unpackUuid(scrambler.unscramble(v))) as [string, string];
}
