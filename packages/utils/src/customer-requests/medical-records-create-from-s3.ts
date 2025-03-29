import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle, Resource } from "@medplum/fhirtypes";
import { createFolderName } from "@metriport/core/domain/filename";
import { bundleToHtml } from "@metriport/core/external/aws/lambda-logic/bundle-to-html";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { makeFhirApi } from "@metriport/core/external/fhir/api/api-factory";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { errorToString } from "@metriport/shared/common/error";
import { parseFhirBundle } from "@metriport/shared/medical";
import * as AWS from "aws-sdk";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { elapsedTimeAsStr } from "../shared/duration";
import { buildGetDirPathInside, initRunsFolder } from "../shared/folder";
import { getCxData } from "../shared/get-cx-data";

dayjs.extend(duration);

/**
 * Utility to generate Medical Records from FHIR bundles stored on S3.
 *
 * This will:
 *    - create a new folder in the "runs" dir for the customer, with "MR-Summaries" as prefix
 *    - get each patient's bundles from S3
 *    - group them into a single bundle (likely very large!)
 *    - convert the bundle to HTML (this can take a while!)
 *    - store it in the "MR-Summaries"
 *
 * You might want to open the HTML and save it as PDF before sharing it with the customer.
 *
 * Update the respective env variables and run `ts-node src/customer-requests/medical-records-create-from-s3.ts`
 */

/**
 * List of patients to generate Medical Records for.
 */
const patientIds: string[] = [];

/**
 * Disable this to simplify logs per patient
 */
const isDebug = false;
const suffixToInclude = ".xml.json";

const cxId = getEnvVarOrFail("CX_ID");
const region = getEnvVarOrFail("AWS_REGION");
const bucketName = getEnvVarOrFail("CONVERSIONS_CDA_TO_FHIR_BUCKET_NAME");
const fhirBaseUrl = getEnvVarOrFail("FHIR_SERVER_URL");

const s3 = new S3Utils(region);
const fhirApi = makeFhirApi(cxId, fhirBaseUrl);

const getDirName = buildGetDirPathInside(`MR-Summaries`);

async function main() {
  initRunsFolder();
  const { orgName } = await getCxData(cxId, undefined, false);
  console.log(
    `########################## Running for ${orgName} - ${cxId}, ${
      patientIds.length
    } patients... - started at ${new Date().toISOString()}`
  );
  const startedAt = Date.now();

  const dirName = getDirName(orgName);
  fs.mkdirSync(`./${dirName}`, { recursive: true });
  console.log(`Storing files on dir ${dirName}`);

  for (const patientId of patientIds) {
    const log = (msg: string) => console.log(`${new Date().toISOString()} [${patientId}] ${msg}`);
    const patientStartedAt = Date.now();
    try {
      log(`>>> Generating MR for patient ${patientId}...`);
      await getMedicalRecordURL(patientId, dirName, log);
      log(`... Patient ${patientId} is done in ${elapsedTimeAsStr(patientStartedAt)}`);
    } catch (error) {
      log(`Error downloading MR: ${errorToString(error)}`);
    }
  }
  console.log(`>>> Done all patients in ${elapsedTimeAsStr(startedAt)}`);
}

async function getMedicalRecordURL(
  patientId: string,
  dirName: string,
  log: typeof console.log
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const debug = (params: any) => isDebug && log(params);
  log(`!!! You need a FHIR server to run this script.`);
  const patientFhir = await fhirApi.readResource("Patient", patientId);
  const resources: Resource[] = [patientFhir];
  const patientPrefix = createFolderName(cxId, patientId);
  const objects = await s3.listObjects(bucketName, patientPrefix);
  const filteredObjects = objects?.filter(obj => obj.Key?.includes(suffixToInclude)) ?? [];

  async function processSingleObject(object: AWS.S3.Object) {
    const key = object.Key;
    if (!key) {
      debug(`No object name, skipping...`);
      return;
    }
    debug(`Downloading ${key}...`);
    const objBuffer = await s3.downloadFile({ bucket: bucketName, key });
    const rawBuffer = objBuffer.toString();
    const bundle = parseFhirBundle(rawBuffer);
    if (!bundle) {
      log(`Not a bundle, skipping...`);
      return;
    }
    const objResources = (bundle.entry ?? []).flatMap(entry => entry.resource ?? []);
    resources.push(...objResources);
  }

  await executeAsynchronously(filteredObjects, processSingleObject, {
    numberOfParallelExecutions: 10,
  });

  const resultingBundle: Bundle<Resource> = {
    resourceType: "Bundle",
    type: "collection",
    entry: resources.map(resource => ({ resource })),
  };
  const bundleFileName = `./${dirName}/${patientId}.json`;
  debug(`Writing bundle (${resources.length} resources) to file ${bundleFileName}`);
  fs.writeFileSync(bundleFileName, JSON.stringify(resultingBundle));

  debug(`Converting to HTML... (this can take a while)`);
  const html = bundleToHtml(resultingBundle);

  const mrFileName = `./${dirName}/${patientId}.html`;
  debug(`Storing MR on ${mrFileName}`);
  fs.writeFileSync(mrFileName, html);
}

main();
