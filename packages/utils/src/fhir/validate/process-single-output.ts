import { OperationOutcome, OperationOutcomeIssue } from "@medplum/fhirtypes";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { getEnvVarOrFail, limitStringLength } from "@metriport/shared";

const region = getEnvVarOrFail("AWS_REGION");
const s3 = new S3Utils(region);
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

export async function processSingleOutput({
  key,
  bucketName,
  errors: uniqueErrors,
  warnings: uniqueWarnings,
  infos: uniqueInfos,
  log = console.log,
}: {
  key: string;
  bucketName: string;
  errors: Map<string, number>;
  warnings: Map<string, number>;
  infos: Map<string, number>;
  log?: typeof console.log;
}): Promise<string> {
  log(`Downloading ${key}...`);
  const objBuffer = await s3.downloadFile({ bucket: bucketName, key });

  const contents = objBuffer.toString();
  const lines = contents.split("\n");
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
  return contents;
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
