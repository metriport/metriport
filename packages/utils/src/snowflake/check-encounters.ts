import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { FhirBundleSdk } from "@metriport/fhir-sdk";
import { createConsolidatedDataFileNameWithSuffix } from "@metriport/core/domain/consolidated/filename";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { initRunsFolder, buildGetDirPathInside } from "../shared/folder";
import { initFile } from "../shared/file";
import { getCxData } from "../shared/get-cx-data";
import fs from "fs";

dayjs.extend(duration);

/**
 * Utility to check for patients with encounters in their consolidated data files.
 *
 * Downloads S3 files containing consolidated FHIR bundles and checks if they contain
 * Encounter resources. Processes patients in parallel.
 *
 * Set the variables below and run the script.
 */

const region = getEnvVarOrFail("AWS_REGION");
const cxId = getEnvVarOrFail("CX_ID");
const bucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");

const patientIds: string[] = [];

const numberOfParallelExecutions = 10;

const csvHeader = "patientId,hasEncounters,encounterCount,error\n";
const getOutputFileName = buildGetDirPathInside(`snowflake/encounter-check`);

interface PatientEncounterResult {
  patientId: string;
  hasEncounters: boolean;
  encounterCount: number;
  error?: string;
}

function createS3Client(): S3Utils {
  return new S3Utils(region);
}

async function checkPatientEncounters({
  s3Client,
  patientId,
  cxId,
}: {
  s3Client: S3Utils;
  patientId: string;
  cxId: string;
}): Promise<PatientEncounterResult> {
  try {
    const fileKey = createConsolidatedDataFileNameWithSuffix(cxId, patientId) + ".json";
    console.log(`Checking for encounters in ${fileKey}`);

    const fileExists = await s3Client.fileExists(bucketName, fileKey);
    if (!fileExists) {
      return {
        patientId,
        hasEncounters: false,
        encounterCount: 0,
        error: "Consolidated data file not found",
      };
    }

    const fileContent = await s3Client.downloadFile({ bucket: bucketName, key: fileKey });
    const bundle = JSON.parse(fileContent.toString());

    const sdk = await FhirBundleSdk.create(bundle);
    const encounters = sdk.getEncounters();

    return {
      patientId,
      hasEncounters: encounters.length > 0,
      encounterCount: encounters.length,
    };
  } catch (error) {
    return {
      patientId,
      hasEncounters: false,
      encounterCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function main() {
  initRunsFolder();
  const { log } = out("");

  const startedAt = Date.now();
  log(`>>> Starting encounter check for ${patientIds.length} patients...`);

  const { orgName } = await getCxData(cxId, undefined, false);

  const s3Client = createS3Client();
  const results: PatientEncounterResult[] = [];

  const outputFileName = getOutputFileName(orgName) + ".csv";
  const withEncountersFileName = getOutputFileName(orgName) + "_with_encounters.csv";
  const withoutEncountersFileName = getOutputFileName(orgName) + "_without_encounters.csv";
  const failedFileName = getOutputFileName(orgName) + "_failed.csv";

  initFile(outputFileName, csvHeader);
  initFile(withEncountersFileName, csvHeader);
  initFile(withoutEncountersFileName, csvHeader);
  initFile(failedFileName, csvHeader);

  log(
    `>>> Processing ${patientIds.length} patients with ${numberOfParallelExecutions} parallel executions...`
  );

  await executeAsynchronously(
    patientIds,
    async patientId => {
      const result = await checkPatientEncounters({ s3Client, patientId, cxId });
      results.push(result);
    },
    {
      numberOfParallelExecutions,
      minJitterMillis: 10,
      maxJitterMillis: 200,
    }
  );

  for (const result of results) {
    const csvRow = `${result.patientId},${result.hasEncounters},${result.encounterCount},${
      result.error || ""
    }\n`;
    fs.appendFileSync(outputFileName, csvRow);

    if (result.error) {
      fs.appendFileSync(failedFileName, csvRow);
    } else if (result.hasEncounters) {
      fs.appendFileSync(withEncountersFileName, csvRow);
    } else {
      fs.appendFileSync(withoutEncountersFileName, csvRow);
    }
  }

  const patientsWithEncounters = results.filter(r => r.hasEncounters);
  const patientsWithoutEncounters = results.filter(r => !r.hasEncounters && !r.error);
  const failed = results.filter(r => r.error);

  log(`\n=== RESULTS ===`);
  log(`Total patients processed: ${results.length}`);
  log(`Patients with encounters: ${patientsWithEncounters.length}`);
  log(`Patients without encounters: ${patientsWithoutEncounters.length}`);
  log(`Failed: ${failed.length}`);

  log(`\n=== OUTPUT FILES ===`);
  log(`All results: ${outputFileName}`);
  log(`Patients with encounters: ${withEncountersFileName}`);
  log(`Patients without encounters: ${withoutEncountersFileName}`);
  log(`Failed patients: ${failedFileName}`);

  const elapsed = Date.now() - startedAt;
  log(`>>> Done checking encounters for all ${results.length} patients in ${elapsed} ms`);
}

main().catch(error => {
  console.error("Script failed:", error);
  process.exit(1);
});
