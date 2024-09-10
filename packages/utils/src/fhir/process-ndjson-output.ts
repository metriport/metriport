import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { OperationOutcome, OperationOutcomeIssue } from "@medplum/fhirtypes";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { getEnvVarOrFail, limitStringLength } from "@metriport/shared";
import AWS from "aws-sdk";
import { elapsedTimeAsStr } from "../shared/duration";

/**
 * Script used to parse the output of AWS Healthlake and list the issues found there.
 *
 * To use this script, set the environment vars:
 * - HEATHLAKE_BUCKET_NAME: the S3 bucket name
 * - HEATHLAKE_FAILURE_PREFIX: the S3 prefix where the output files are stored
 * - AWS_REGION: the AWS region
 */

const prefix = getEnvVarOrFail("HEATHLAKE_FAILURE_PREFIX");
const bucketName = getEnvVarOrFail("HEATHLAKE_BUCKET_NAME");
const region = getEnvVarOrFail("AWS_REGION");

const suffixToInclude = ".ndjson";
const maxCharsOnError = 100;

type OutputLine = {
  lineId: number;
  resourceId: string;
  resourceType: string;
  UpdateResourceResponse?: {
    jsonBlob: OperationOutcome;
    statusCode: number;
  };
};

async function main() {
  const startedAt = Date.now();
  console.log(`########################## Started at ${new Date(startedAt).toISOString()}`);

  const healthlake = new AWS.HealthLake();
  healthlake.startFHIRImportJob();

  const s3 = new S3Utils(region);
  const objects = await s3.listObjects(bucketName, prefix);
  const filteredObjects = objects?.filter(obj => obj.Key?.includes(suffixToInclude)) ?? [];

  console.log(`Got ${filteredObjects.length} files to process.`);

  const uniqueErrors: Map<string, number> = new Map();
  const uniqueWarnings: Map<string, number> = new Map();
  const uniqueInfos: Map<string, number> = new Map();

  let index = 0;

  async function processSingleObject(object: AWS.S3.Object) {
    const { log } = out(`${++index}`);
    const key = object.Key;
    if (!key) {
      log(`No object name, skipping...`);
      return;
    }
    log(`Downloading ${key}...`);
    const objBuffer = await s3.downloadFile({ bucket: bucketName, key });

    const lines = objBuffer.toString().split("\n");
    for (const line of lines) {
      const output: OutputLine = JSON.parse(line);
      if (!("UpdateResourceResponse" in output) || !output.UpdateResourceResponse) continue;
      const errors = output.UpdateResourceResponse.jsonBlob.issue?.flatMap(getErrors) ?? [];
      const warnings = output.UpdateResourceResponse.jsonBlob.issue?.flatMap(getWarnings) ?? [];
      const infos = output.UpdateResourceResponse.jsonBlob.issue?.flatMap(getInfos) ?? [];
      for (const error of errors) {
        if (uniqueErrors.has(error)) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          uniqueErrors.set(error, uniqueErrors.get(error)! + 1);
        } else {
          uniqueErrors.set(error, 1);
        }
      }
      for (const warning of warnings) {
        if (uniqueWarnings.has(warning)) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          uniqueWarnings.set(warning, uniqueWarnings.get(warning)! + 1);
        } else {
          uniqueWarnings.set(warning, 1);
        }
      }
      for (const info of infos) {
        if (uniqueInfos.has(info)) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          uniqueInfos.set(info, uniqueInfos.get(info)! + 1);
        } else {
          uniqueInfos.set(info, 1);
        }
      }
    }
  }

  await executeAsynchronously(filteredObjects, processSingleObject, {
    numberOfParallelExecutions: 10,
  });

  console.log(`Errors found:\n`, uniqueErrors);
  console.log(`Warnings found:\n`, uniqueWarnings);
  console.log(`Infos found:\n`, uniqueInfos);

  console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
}

function getErrors(issue: OperationOutcomeIssue): string | string[] {
  if (issue.severity !== "error" && issue.severity !== "fatal") return [];
  return issueToString(issue);
}
function getWarnings(issue: OperationOutcomeIssue): string | string[] {
  if (issue.severity !== "warning") return [];
  return issueToString(issue);
}
function getInfos(issue: OperationOutcomeIssue): string | string[] {
  if (issue.severity !== "information") return [];
  return issueToString(issue);
}
function issueToString(issue: OperationOutcomeIssue): string | string[] {
  return issue && issue.diagnostics ? limitStringLength(issue.diagnostics, maxCharsOnError) : [];
}

main();
