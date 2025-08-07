import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import fs from "fs";
import csvParser from "csv-parser";
import { faker } from "@faker-js/faker";
import { createCsv, InputRowFacilityImport } from "./bulk-import-facility";
import { Command } from "commander";
import { MetriportError } from "@metriport/shared";

/*
 * This script will read NPIs from a csv saved locally.
 *
 * Run this script from the package root. Not from src/facility/
 *
 *
 * It outputs the result of processing in runs/generate-csv/timestamp with the name as the timestamp.
 *
 * Format of the .csv file:
 * - first line contains column names
 * - minimum columns: npi (Will not read the rest)
 *
 *
 * Execute this with:
 * $ ts-node src/facility/generate-csv  --input-file <inputfile> --start-row <startrow> --end-row <endrow>
 */
type GenerateCsvParams = {
  inputFile: string;
  startRow: number;
  endRow: number;
};

const CSV_HEADER = ["npi", "facilityName", "facilityType", "cqOboOid", "cwOboOid"].join(",") + "\n";

async function main({ inputFile, startRow, endRow }: GenerateCsvParams) {
  if (isNaN(startRow) || isNaN(endRow) || startRow < 1 || endRow < startRow) {
    throw new MetriportError(`Invalid range: start=${startRow}, end=${endRow}`, undefined, {
      inputFile,
      startRow,
      endRow,
    });
  }

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const timestamp = `${yyyy}-${mm}-${dd}`;

  const folderPath = `runs/generate-csv/${timestamp}`;
  const fileName = `${timestamp}.csv`;
  const fullPath = `${folderPath}/${fileName}`;

  const results: InputRowFacilityImport[] = [];
  let rowCount = 0;

  await createCsv(fullPath, CSV_HEADER);

  fs.createReadStream(inputFile)
    .pipe(csvParser())
    .on("data", (row: Record<string, string>) => {
      rowCount++;
      if (rowCount < startRow || rowCount > endRow) return;

      const npi = row["npi"]?.trim();
      if (!npi) return;

      const facilityType: InputRowFacilityImport["facilityType"] =
        Math.random() < 0.5 ? "obo" : "non-obo";
      let cqOboOid = "",
        cwOboOid = "";
      if (facilityType === "obo") {
        cqOboOid = `2.16.840.1.${getRandomNumber()}`;
        cwOboOid = `2.16.840.1.${getRandomNumber()}`;
      }

      results.push({ npi, facilityName: faker.company.name(), facilityType, cqOboOid, cwOboOid });
    })
    .on("end", () => {
      const lines = results.map(r =>
        [
          r.npi,
          `"${r.facilityName.replace(/"/g, '""')}"`,
          r.facilityType,
          r.cqOboOid,
          r.cwOboOid,
        ].join(",")
      );
      fs.writeFileSync(fullPath, [CSV_HEADER, ...lines].join("\n"), "utf-8");
      console.log(`Wrote ${results.length} rows (data rows ${startRow}–${endRow}) → ${fullPath}`);
    })
    .on("error", err => {
      console.error("Error:", err);
      process.exit(1);
    });
  //TODO: Upload to S3
}

function getRandomNumber(): number {
  return faker.number.int({ min: 1_000_000, max: 9_999_999 });
}

const program = new Command();

//TODO: add optional result name field
program
  .name("generate-csv")
  .requiredOption("--input-file <inputfile>", "The path to the input file.")
  .requiredOption("--start-row <startrow>", "The row you want the script to start reading from.")
  .requiredOption("--end-row <endrow>", `The row you want the script to stop reading from.`)
  .description("Creates a test csv for bulk-import-facility")
  .showHelpAfterError()
  .version("1.0.0")
  .action(main);

if (require.main === module) {
  program.parse(process.argv);
}
export default program;
