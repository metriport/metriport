import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { BundleEntry, Resource } from "@medplum/fhirtypes";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { groupBy } from "lodash";
import { ellapsedTimeAsStr } from "../shared/duration";
import { initRunsFolder } from "../shared/folder";
import {
  buildGetDirPathInside,
  getFilesToProcessFromLocal,
  getFilesToProcessFromS3,
} from "./get-files";
import { processMedication } from "./medication";
import { processMedicationRequest } from "./medication-requests";
import { processMedicationStatement } from "./medication-statement";

dayjs.extend(duration);

/**
 * Utility to report differences between two FHIR bundles.
 * Commonly used to compare the original bundle with the deduplicated one.
 *
 * You can choose to provide the bundles in two ways:
 * - `patientIds`: list of patient IDs to fetch the bundles from S3
 * - `localConsolidated`: local path to the consolidated bundles
 *
 * If both are provided, the patientIds/S3 will be used.
 *
 * The results are stored on the `runs/dedup-reports` folder.
 *
 * Run with:
 * > ts-node src/fhir-dedup/report-dedup.ts
 */

/**
 * List of patients to get the bundles from S3.
 */
const patientIds: string[] = [];
/**
 * Path to the local consolidated bundles.
 */
const localConsolidated = "";

const cxId = getEnvVarOrFail("CX_ID");
const region = getEnvVarOrFail("AWS_REGION");
const bucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");

const startedAt = Date.now();
const dirName = buildGetDirPathInside(`dedup-reports`, startedAt);

async function main() {
  initRunsFolder();

  const dedupPairs =
    patientIds && patientIds.length
      ? await getFilesToProcessFromS3({ dirName, cxId, patientIds, bucketName, region })
      : await getFilesToProcessFromLocal(dirName, localConsolidated);
  if (!dedupPairs || !dedupPairs.length) return;

  console.log(`\nGenerating reports...\n`);
  for (const pair of dedupPairs) {
    const { log } = out(`patient ${pair.patientId}`);
    log(`Found files:\n... O ${pair.original.localFileName}\n... D ${pair.dedup.localFileName}`);
    const patientDirName = dirName + "/" + pair.patientId;
    fs.mkdirSync(`./${patientDirName}`, { recursive: true });

    const originalFile = fs.readFileSync(pair.original.localFileName, "utf8");
    const dedupFile = fs.readFileSync(pair.dedup.localFileName, "utf8");

    const originalResources: Resource[] =
      JSON.parse(originalFile).entry?.map((entry: BundleEntry) => entry.resource) ?? [];
    const dedupResources: Resource[] =
      JSON.parse(dedupFile).entry?.map((entry: BundleEntry) => entry.resource) ?? [];

    const groupedOriginal = groupBy(originalResources, "resourceType");
    const groupedDedup = groupBy(dedupResources, "resourceType");

    log(`Processing Medication...`);
    await processMedication(groupedOriginal, groupedDedup, patientDirName);

    log(`Processing MedicationStatement...`);
    await processMedicationStatement(groupedOriginal, groupedDedup, patientDirName);

    log(`Processing processMedicationRequest...`);
    await processMedicationRequest(groupedOriginal, groupedDedup, patientDirName);
  }
  console.log(`>>> Done in ${ellapsedTimeAsStr(startedAt)}`);
}

main();
