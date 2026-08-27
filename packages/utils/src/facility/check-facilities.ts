import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import dayjs, { duration } from "dayjs";
import { readNpisFromCsv, verifyFacilities } from "./utils";

dayjs.extend(duration);
/**
 * Checks if facilities exist in CommonWell and CareQuality.
 *
 * Reads facilities in bulk from a CSV file containing NPIs.
 * Verifies the facilities exist in CommonWell and CareQuality.
 *
 * Logs the result of processing to the console.
 *
 * Set the variables below to configure the script.
 *
 * Usage:
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

    await verifyFacilities({
      npis,
      cxId,
      timeout: timeout.asMilliseconds(),
    });
  } catch (error) {
    console.error("Error during assessment:", error);
    throw error;
  }
}

main();
