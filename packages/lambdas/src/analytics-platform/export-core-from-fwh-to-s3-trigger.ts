import { ExportCoreFromFwhToS3Batch } from "@metriport/core/command/analytics-platform/export-core-from-fwh-to-s3/command/export-core-from-fwh-to-s3/export-core-from-fwh-to-s3-batch";
import { RAW_TO_CORE_COMPLETE_EVENT_TYPE } from "@metriport/core/command/analytics-platform/raw-to-core/command/raw-to-core";
import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { getEnvVarOrFail } from "@metriport/shared";
import { SQSEvent } from "aws-lambda";
import { z } from "zod";
import { capture } from "../shared/capture";
import { parseBody } from "../shared/parse-body";
import { getSingleMessageOrFail } from "../shared/sqs";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvVarOrFail("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvVarOrFail("AWS_REGION");
// Set by us
const featureFlagsTableName = getEnvVarOrFail("FEATURE_FLAGS_TABLE_NAME");

FeatureFlags.init(region, featureFlagsTableName);

export const handler = capture.wrapHandler(async (event: SQSEvent) => {
  capture.setExtra({ event, context: lambdaName });

  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;

  const { cxId, jobId } = parseBody(exportCoreFromFwhToS3TriggerSchema, message.body);

  const exportHandler = new ExportCoreFromFwhToS3Batch();
  await exportHandler.exportCoreFromFwhToS3({ cxId, rawToCoreJobId: jobId });
});

const exportCoreFromFwhToS3TriggerSchema = z.union([
  z.object({
    cxId: z.string(),
    jobId: z.string(),
    eventType: z.literal(RAW_TO_CORE_COMPLETE_EVENT_TYPE),
  }),
  z.object({
    cxId: z.string(),
    jobId: z.string(),
  }),
]);
