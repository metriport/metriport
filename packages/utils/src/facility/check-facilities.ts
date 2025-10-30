import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import dayjs from "dayjs";
import { readNpisFromCsv, verifyFacilities } from "./utils";

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
 * $ ts-node src/facility/check-facilities
 */

const cxId = "";
const inputPath = "";
const timeout = dayjs.duration(1.5, "seconds");

async function main() {
  console.log("Starting facility assessment...");

  try {
    const npis = await readNpisFromCsv(inputPath);
    console.log(`Found ${npis.length} NPIs to assess`);

    await verifyFacilities(npis, cxId, timeout.asMilliseconds());
  } catch (error) {
    console.error("Error during assessment:", error);
    throw error;
  }
}

main();
