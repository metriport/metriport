import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { sleep } from "@metriport/core/util/sleep";
import { errorToString, getEnvVarOrFail, uuidv7 } from "@metriport/shared";
import axios from "axios";
import { Command } from "commander";
import csvParser from "csv-parser";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { createReadStream } from "fs";
import { elapsedTimeAsStr } from "../../shared/duration";

dayjs.extend(duration);

/**
 * This script reads a CSV file with patient data and calls the CommonWell update endpoint
 * for each customer (cx_id) with their respective patient IDs.
 *
 * Optional environment variables:
 *   - API_URL: The base URL for the Metriport API (defaults to http://localhost:8080)
 *
 * To run:
 * - Set the CSV_FILE_PATH to point to your CSV file
 * - Run the script with `ts-node src/commonwell/migration-v1-to-v2/update-patients-from-csv.ts`
 */

const program = new Command();
program
  .name("update-patients-from-csv")
  .description("CLI to update patients in CommonWell from CSV file")
  .option("-f, --file <path>", "Path to CSV file")
  .option("--dry-run", "Show what would be done without making actual API calls")
  .showHelpAfterError();

// Configuration
const numberOfParallelExecutions = 1;
const apiUrl = getEnvVarOrFail("API_URL");

const cxExcludeList: string[] = [];
const cxIncludeList: string[] = [];

type PatientRecord = {
  cx_id: string;
  id: string;
};

type CustomerPatients = {
  cxId: string;
  patientIds: string[];
};

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();

  program.parse();
  const options = program.opts();
  const { file: csvFilePath, dryRun } = options;

  console.log(`############## Started at ${new Date(startedAt).toISOString()} ##############`);
  console.log(`CSV File: ${csvFilePath}`);
  console.log(`API URL: ${apiUrl}`);
  console.log(`Parallel executions: ${numberOfParallelExecutions}`);
  console.log(`Dry run: ${dryRun ? "YES" : "NO"}`);

  try {
    // STEP 1: Read and parse CSV file
    console.log("STEP 1: Reading CSV file...");
    const records: PatientRecord[] = await new Promise((resolve, reject) => {
      const results: PatientRecord[] = [];
      createReadStream(csvFilePath)
        .pipe(csvParser())
        .on("data", (data: PatientRecord) => {
          if (data.cx_id && data.id) {
            results.push(data);
          }
        })
        .on("end", () => resolve(results))
        .on("error", reject);
    });

    console.log(`Found ${records.length} patient records in CSV`);

    // STEP 2: Group patients by customer ID
    console.log("STEP 2: Grouping patients by customer...");
    const customerPatientsMap = new Map<string, string[]>();

    for (const record of records) {
      const { cx_id, id } = record;
      if (!cx_id || !id) {
        console.warn(`Skipping invalid record: ${JSON.stringify(record)}`);
        continue;
      }

      if (cxExcludeList.includes(cx_id)) {
        console.log(`Skipping pt of customer ${cx_id} because it is in the exclude list`);
        continue;
      }
      if (cxIncludeList.length > 0 && !cxIncludeList.includes(cx_id)) {
        console.log(`Skipping pt of customer ${cx_id} because it is not in the include list`);
        continue;
      }

      if (!customerPatientsMap.has(cx_id)) {
        customerPatientsMap.set(cx_id, []);
      }
      customerPatientsMap.get(cx_id)!.push(id); // eslint-disable-line @typescript-eslint/no-non-null-assertion
    }

    const customerPatients: CustomerPatients[] = Array.from(customerPatientsMap.entries()).map(
      ([cxId, patientIds]) => ({ cxId, patientIds })
    );

    console.log(`Found ${customerPatients.length} customers with patients`);
    for (const { cxId, patientIds } of customerPatients) {
      console.log(`  Customer ${cxId}: ${patientIds.length} patients`);
    }

    // STEP 3: Call CommonWell update endpoint for each customer
    console.log("STEP 3: Calling CommonWell update endpoints...");
    const results = await executeAsynchronously(
      customerPatients,
      async ({ cxId, patientIds }: { cxId: string; patientIds: string[] }) => {
        return updatePatientsForCustomer(cxId, patientIds, apiUrl, dryRun);
      },
      {
        numberOfParallelExecutions,
        minJitterMillis: 1_000,
        maxJitterMillis: 3_000,
      }
    );

    // STEP 4: Report results
    const successful = results.filter(r => r.status === "fulfilled").length;
    const failed = results.filter(r => r.status === "rejected").length;
    const totalPatients = customerPatients.reduce((sum, cp) => sum + cp.patientIds.length, 0);

    console.log(
      `>>>>>>> Done processing ${
        customerPatients.length
      } customers (${totalPatients} total patients) after ${elapsedTimeAsStr(startedAt)}`
    );
    console.log(`Successful: ${successful}, Failed: ${failed}`);

    // Log any failures
    const failures = results
      .filter((r: PromiseSettledResult<void>) => r.status === "rejected")
      .map((r: PromiseSettledResult<void>) => (r as PromiseRejectedResult).reason);

    if (failures.length > 0) {
      console.log("\nFailures:");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      failures.forEach((failure: any, index: number) => {
        console.log(`${index + 1}. ${errorToString(failure)}`);
      });
    }
  } catch (error) {
    console.error("Error during execution:", error);
    throw error;
  }
}

async function updatePatientsForCustomer(
  cxId: string,
  patientIds: string[],
  apiUrl: string,
  dryRun: boolean
): Promise<void> {
  const { log } = console;
  const requestId = `update-csv-${Date.now()}-${uuidv7()}`;

  log(`Updating ${patientIds.length} patients for customer ${cxId} (requestId: ${requestId})`);

  if (dryRun) {
    log(
      `[DRY RUN] Would call POST ${apiUrl}/internal/patient/update-all/commonwell with cxId=${cxId} and ${patientIds.length} patient IDs`
    );
    return;
  }

  try {
    const response = await axios.post(
      `${apiUrl}/internal/patient/update-all/commonwell`,
      {
        patientIds,
      },
      {
        params: {
          cxId,
        },
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const { failedUpdateCount } = response.data;
    log(`Successfully updated patients for customer ${cxId}. Failed updates: ${failedUpdateCount}`);

    if (failedUpdateCount > 0) {
      console.warn(`Warning: ${failedUpdateCount} patient updates failed for customer ${cxId}`);
    }
  } catch (error) {
    const errorMsg = `Failed to update patients for customer ${cxId}: ${errorToString(error)}`;
    log(errorMsg);
    throw new Error(errorMsg);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error("Script failed:", error);
    process.exit(1);
  });
}
