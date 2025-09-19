import {
  groupAndMergeCSVs,
  GroupAndMergeCSVsParams,
} from "@metriport/core/command/analytics-platform/merge-csvs/index";
import { getEnvVarOrFail } from "@metriport/shared";
import { SQSEvent } from "aws-lambda";
import { z } from "zod";
import { capture } from "../shared/capture";
import { prefixedLog } from "../shared/log";
import { parseBody } from "../shared/parse-body";
import { getSingleMessageOrFail } from "../shared/sqs";

// Automatically set by AWS
const lambdaName = getEnvVarOrFail("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvVarOrFail("AWS_REGION");
// Set by us
const bucket = getEnvVarOrFail("ANALYTICS_BUCKET_NAME");

export type GroupAndMergeCSVsParamsLambda = Omit<
  GroupAndMergeCSVsParams,
  "sourceBucket" | "destinationBucket" | "region"
>;

export const handler = capture.wrapHandler(async (event: SQSEvent) => {
  capture.setExtra({ event, context: lambdaName });
  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;
  const parsedBody: GroupAndMergeCSVsParamsLambda = parseBody(inputSchema, message.body);
  const { cxId, fhirToCsvJobId, mergeCsvJobId, patientIds, targetGroupSizeMB } = parsedBody;
  capture.setExtra({
    cxId,
    fhirToCsvJobId,
    mergeCsvJobId,
    patientIdsCount: patientIds.length,
    targetGroupSizeMB,
  });
  const log = prefixedLog(`mergeCsvJobId ${mergeCsvJobId}`);
  log(
    `Running with params: ${JSON.stringify({
      cxId,
      fhirToCsvJobId,
      mergeCsvJobId,
      patientIdsCount: patientIds.length,
      targetGroupSizeMB,
    })}`
  );

  await groupAndMergeCSVs({
    cxId,
    fhirToCsvJobId,
    mergeCsvJobId,
    patientIds,
    targetGroupSizeMB,
    sourceBucket: bucket,
    destinationBucket: bucket,
    region,
  });
});

export const inputSchema = z.object({
  cxId: z.string(),
  fhirToCsvJobId: z.string(),
  mergeCsvJobId: z.string(),
  patientIds: z.array(z.string()),
  targetGroupSizeMB: z.number(),
});
