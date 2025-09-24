import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { readNpisFromCsv, verifyFacilities } from "./utils";
import dayjs from "dayjs";
import { Command } from "commander";

/*
 * This script will read NPIs from a local csv.
 * It will check if the facility is present in CommonWell and CareQuality.
 *
 * It console logs the result of processing.
 *
 * Format of the .csv file:
 * - first line contains column name: npi
 * - minimum columns: npi
 *
 * Set the API_URL env var.
 * Set the input variables below.
 *
 * Execute this with:
 * $ ts-node src/facility/check-facilities --input-path <inputpath> --cx-id <cxId>
 */
const timeout = dayjs.duration(1, "seconds");

interface FacilityCheckParams {
  inputPath: string;
  cxId: string;
}

async function main({ inputPath, cxId }: FacilityCheckParams) {
  console.log("Starting facility assessment...");

  try {
    const npis = await readNpisFromCsv(inputPath);
    console.log(`Found ${npis.length} NPIs to assess`);

    verifyFacilities(npis, cxId, timeout.asMilliseconds());
  } catch (error) {
    console.error("Error during assessment:", error);
    throw error;
  }
}

const program = new Command();

program
  .name("check-facilities")
  .requiredOption("--input-path <inputpath>", "The path to the input csv file")
  .requiredOption("--cx-id <cxId>", "The customer ID for the facilities to be created under.")
  .description("Checks if the facilities are present in CommonWell and CareQuality.")
  .showHelpAfterError()
  .version("1.0.0")
  .action(main);

if (require.main === module) {
  program.parse(process.argv);
}
export default program;
