import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { executeWithNetworkRetries, getEnvVarOrFail, sleep } from "@metriport/shared";
import axios from "axios";
import csv from "csv-parser";
import fs, { createReadStream } from "fs";
import { chunk, groupBy } from "lodash";
import { normalizeExternalIdUtils } from "../bulk-insert-patients";
import { elapsedTimeAsStr } from "../shared/duration";
import { buildGetDirPathInside } from "../shared/folder";
import { initFile } from "../shared/file";

/**
 * Trigger ingestion of patients' consolidated into OpenSearch.
 *
 * Usage:
 * - Set the environment variables in the .env file
 * - Create a CSV file with columns cx_id,id (see mapCsvToIds for options)
 * - Run: `ts-node src/open-search/ingest-patients.ts <path-to-csv>`
 */

const CHUNK_SIZE = 100;
const PARALLEL_CALLS = 5;
const API_URL = getEnvVarOrFail("API_URL");

interface PatientRecord {
  cxId: string;
  patientId: string;
}

const getFolderName = buildGetDirPathInside(`consolidated-ingestion`);
const outputFolderName = getFolderName("");

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  console.log(`############ Starting... ############`);
  const startedAt = Date.now();

  const csvPath = process.argv[2];
  if (!csvPath) {
    throw new Error("Please provide the path to the CSV file as an argument");
  }

  const results: PatientRecord[] = [];
  const mappingErrors: Array<{ row: string; errors: string }> = [];
  await new Promise<void>((resolve, reject) => {
    createReadStream(csvPath)
      .pipe(
        csv({
          mapHeaders: ({ header }: { header: string }) => {
            return header.replace(/[!@#$%^&*()+=\-[\]\\';,./{}|":<>?~_\s]/gi, "").toLowerCase();
          },
        })
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("data", (data: any) => {
        const result = mapCsvToIds(data);
        if (Array.isArray(result)) {
          mappingErrors.push({
            row: JSON.stringify(data),
            errors: result.map(e => e.error).join("; "),
          });
        } else {
          results.push(result);
        }
      })
      .on("end", () => resolve())
      .on("error", error => reject(error));
  });

  if (mappingErrors.length > 0) {
    console.log(`mappingErrors: `, mappingErrors);
    throw new Error(`Found ${mappingErrors.length} mapping errors`);
  }
  console.log(`Loaded CSV...`);

  const cxIds = groupBy(results, v => v.cxId);
  console.log(`${Object.keys(cxIds).length} cxs, ${results.length} patients`);

  const failedIngestions: { cxId: string; patientIds: string[]; error: string }[] = [];

  for (const [cxId, entries] of Object.entries(cxIds)) {
    const patientIds = entries.map(v => v.patientId);
    const chunks = chunk(patientIds, CHUNK_SIZE);

    console.log(`Processing cx ${cxId} - ${patientIds.length} patients in ${chunks.length} chunks`);

    await executeAsynchronously(
      chunks,
      async chunk => {
        try {
          console.log(`...Sending chunk of ${chunk.length} patients...`);
          await executeWithNetworkRetries(() =>
            axios.post(`${API_URL}/internal/patient/consolidated/search/ingest`, null, {
              params: {
                cxId,
                patientIds: chunk,
              },
            })
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          failedIngestions.push({
            cxId,
            patientIds: chunk,
            error: errorMessage,
          });
          console.error(`...Failed to ingest chunk for cx ${cxId}:`, errorMessage);
        }
      },
      { numberOfParallelExecutions: PARALLEL_CALLS }
    );
  }

  console.log(``);
  console.log(`Total time: ${elapsedTimeAsStr(startedAt)}ms - ${results.length} patient IDs`);

  if (failedIngestions.length > 0) {
    const errorFilePath = `${outputFolderName}/failed-ingestions.json`;
    initFile(errorFilePath);
    fs.writeFileSync(errorFilePath, JSON.stringify(failedIngestions, null, 2));
    console.log(``);
    console.log(`Failed ingestions: ${failedIngestions.length} (written to ${errorFilePath})`);
  }
}

export function mapCsvToIds(csvPatient: {
  cxId: string | undefined;
  cx_id: string | undefined;
  cxid: string | undefined;
  id: string | undefined;
  patientId: string | undefined;
  patientid: string | undefined;
}): PatientRecord | Array<{ field: string; error: string }> {
  const cxIdRaw = csvPatient.cxId ?? csvPatient.cx_id ?? csvPatient.cxid ?? csvPatient.id;
  const cxId = cxIdRaw ? normalizeExternalIdUtils(cxIdRaw) : undefined;

  const patientIdRaw = csvPatient.patientId ?? csvPatient.patientid ?? csvPatient.id;
  const patientId = patientIdRaw ? normalizeExternalIdUtils(patientIdRaw) : undefined;

  if (!cxId || !patientId) {
    return [{ field: "general", error: "Missing required fields" }];
  }
  return { cxId, patientId };
}

if (require.main === module) {
  main();
}
