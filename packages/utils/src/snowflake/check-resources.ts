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
import { Command } from "commander";

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
const medicalDocumentsBucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const conversionBucketName = getEnvVarOrFail("CONVERSION_BUCKET_NAME");

const patientIds: string[] = [];

const numberOfParallelExecutions = 10;

const csvHeader = "patientId,hasTargetResource,targetResources,totalResources,emptyBundles,error\n";
const getOutputFileName = buildGetDirPathInside(`snowflake/encounter-check`);

const supportedResourceTypes = ["Encounter", "Condition"];
type SupportedResourceType = (typeof supportedResourceTypes)[number];
const targetResourceType: SupportedResourceType = "Condition";

const program = new Command();
program
  .name("check-encounters")
  .description("CLI to check for encounters in patient bundles.")
  .option("-c, --conversion", "Check conversion bundles instead of consolidated bundles")
  .showHelpAfterError();

interface PatientEncounterResult {
  patientId: string;
  hasTargetResource: boolean;
  targetResources: number;
  totalResources: number;
  emptyBundles: number;
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

    const fileExists = await s3Client.fileExists(medicalDocumentsBucketName, fileKey);
    if (!fileExists) {
      return {
        patientId,
        hasTargetResource: false,
        targetResources: 0,
        totalResources: 0,
        emptyBundles: 0,
        error: "No consolidated data file found",
      };
    }

    const fileContent = await s3Client.downloadFile({
      bucket: medicalDocumentsBucketName,
      key: fileKey,
    });
    const bundle = JSON.parse(fileContent.toString());

    const sdk = await FhirBundleSdk.create(bundle);
    let targetResources = [];
    if (targetResourceType === "Encounter") {
      targetResources = sdk.getEncounters();
    } else if (targetResourceType === "Condition") {
      targetResources = sdk.getConditions();
    }
    const patients = sdk.getPatients();

    const totalResources = bundle.entry?.length ?? 0;
    const isEmptyBundle = totalResources === 1 && patients.length === 1;

    return {
      patientId,
      hasTargetResource: targetResources.length > 0,
      targetResources: targetResources.length,
      totalResources,
      emptyBundles: isEmptyBundle ? 1 : 0,
    };
  } catch (error) {
    return {
      patientId,
      hasTargetResource: false,
      targetResources: 0,
      totalResources: 0,
      emptyBundles: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function checkPatientConversionEncounters({
  s3Client,
  patientId,
  cxId,
  conversionBucketName,
}: {
  s3Client: S3Utils;
  patientId: string;
  cxId: string;
  conversionBucketName: string;
}): Promise<PatientEncounterResult> {
  try {
    const folderPath = `${cxId}/${patientId}/`;

    const objects = await s3Client.listObjects(conversionBucketName, folderPath);
    if (!objects || objects.length === 0) {
      return {
        patientId,
        hasTargetResource: false,
        targetResources: 0,
        totalResources: 0,
        emptyBundles: 0,
        error: "No conversion files found",
      };
    }

    const conversionObjects = objects.filter(o => o.Key?.endsWith(".xml.json"));

    if (conversionObjects.length === 0) {
      return {
        patientId,
        hasTargetResource: false,
        targetResources: 0,
        totalResources: 0,
        emptyBundles: 0,
        error: "No conversion .xml.json files found",
      };
    }

    let totalTargetResources = 0;
    let totalResources = 0;
    let emptyBundles = 0;

    for (const obj of conversionObjects) {
      const objKey = obj.Key;
      if (!objKey) continue;

      try {
        const fileContent = await s3Client.downloadFile({
          bucket: conversionBucketName,
          key: objKey,
        });
        const bundle = JSON.parse(fileContent.toString());
        // TODO Remove once fhir-sdk supports other bundle types
        bundle.type = "collection";

        const sdk = await FhirBundleSdk.create(bundle);
        let targetResources = [];
        if (targetResourceType === "Encounter") {
          targetResources = sdk.getEncounters();
        } else if (targetResourceType === "Condition") {
          targetResources = sdk.getConditions();
        }
        const patients = sdk.getPatients();

        const bundleTotalResources = bundle.entry?.length ?? 0;
        const isEmptyBundle = bundleTotalResources === 1 && patients.length === 1;

        totalTargetResources += targetResources.length;
        totalResources += bundleTotalResources;
        if (isEmptyBundle) emptyBundles += 1;
      } catch (error) {
        console.log(`Error processing conversion bundle ${objKey}: ${error}`);
      }
    }

    return {
      patientId,
      hasTargetResource: totalTargetResources > 0,
      targetResources: totalTargetResources,
      totalResources,
      emptyBundles,
    };
  } catch (error) {
    return {
      patientId,
      hasTargetResource: false,
      targetResources: 0,
      totalResources: 0,
      emptyBundles: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function main() {
  initRunsFolder();
  program.parse();
  const { log } = out("");

  const options = program.opts();
  const isConversionMode = options.conversion;

  const startedAt = Date.now();
  const bundleType = isConversionMode ? "conversion" : "consolidated";
  log(
    `>>> Starting target resource check for ${patientIds.length} patients in ${bundleType} bundles...`
  );

  const { orgName } = await getCxData(cxId, undefined, false);

  const s3Client = createS3Client();
  const results: PatientEncounterResult[] = [];

  const outputFileName = getOutputFileName(orgName) + ".csv";
  const withEncountersFileName =
    getOutputFileName(orgName) + `_with_${targetResourceType.toLowerCase()}s.csv`;
  const withoutEncountersFileName =
    getOutputFileName(orgName) + `_without_${targetResourceType.toLowerCase()}s.csv`;
  const withEmptyBundlesFileName = getOutputFileName(orgName) + "_with_empty_bundles.csv";
  const failedFileName = getOutputFileName(orgName) + "_failed.csv";

  initFile(outputFileName, csvHeader);
  initFile(withEncountersFileName, csvHeader);
  initFile(withoutEncountersFileName, csvHeader);
  initFile(withEmptyBundlesFileName, csvHeader);
  initFile(failedFileName, csvHeader);

  log(
    `>>> Processing ${patientIds.length} patients with ${numberOfParallelExecutions} parallel executions...`
  );

  await executeAsynchronously(
    patientIds,
    async patientId => {
      const result = isConversionMode
        ? await checkPatientConversionEncounters({
            s3Client,
            patientId,
            cxId,
            conversionBucketName,
          })
        : await checkPatientEncounters({ s3Client, patientId, cxId });
      results.push(result);
    },
    {
      numberOfParallelExecutions,
      minJitterMillis: 10,
      maxJitterMillis: 200,
    }
  );

  for (const result of results) {
    const csvRow = `${result.patientId},${result.hasTargetResource},${result.targetResources},${
      result.totalResources
    },${result.emptyBundles},${result.error || ""}\n`;
    fs.appendFileSync(outputFileName, csvRow);

    if (result.error) {
      fs.appendFileSync(failedFileName, csvRow);
    } else if (result.hasTargetResource) {
      fs.appendFileSync(withEncountersFileName, csvRow);
    } else {
      if (result.emptyBundles > 0) {
        fs.appendFileSync(withEmptyBundlesFileName, csvRow);
      }
      fs.appendFileSync(withoutEncountersFileName, csvRow);
    }
  }

  const patientsWithEncounters = results.filter(r => r.hasTargetResource);
  const patientsWithoutEncounters = results.filter(r => !r.hasTargetResource && !r.error);
  const patientsWithEmptyBundles = results.filter(r => r.emptyBundles > 0 && !r.error);
  const totalResources = results.reduce((acc, r) => acc + r.totalResources, 0);
  const failed = results.filter(r => r.error);

  log(`\n=== RESULTS ===`);
  log(`Total patients processed: ${results.length}`);
  log(`Patients with ${targetResourceType} resources: ${patientsWithEncounters.length}`);
  log(`Patients without ${targetResourceType} resources: ${patientsWithoutEncounters.length}`);
  log(`Patients with empty bundles: ${patientsWithEmptyBundles.length}`);
  log(`Total resources: ${totalResources}`);
  log(`Failed: ${failed.length}`);

  log(`\n=== OUTPUT FILES ===`);
  log(`All results: ${outputFileName}`);
  log(`Patients with ${targetResourceType} resources: ${withEncountersFileName}`);
  log(`Patients without ${targetResourceType} resources: ${withoutEncountersFileName}`);
  log(`Patients with empty bundles: ${withEmptyBundlesFileName}`);
  log(`Failed patients: ${failedFileName}`);

  const elapsed = Date.now() - startedAt;
  log(
    `>>> Done checking ${targetResourceType} resources for all ${results.length} patients in ${elapsed} ms`
  );
}

main().catch(error => {
  console.error("Script failed:", error);
  process.exit(1);
});
