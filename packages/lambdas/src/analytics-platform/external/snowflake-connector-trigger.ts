import { SnowflakeIngestorBatch } from "@metriport/core/command/analytics-platform/connectors/snowflake/snowflake-ingestor-batch";
import { EXPORT_CORE_FROM_FWH_TO_S3_COMPLETE_EVENT_TYPE } from "@metriport/core/command/analytics-platform/export-core-from-fwh-to-s3/command/export-core-from-fwh-to-s3/export-core-from-fwh-to-s3";
import { isDatawarehouseSnowflakeEnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { getEnvVarOrFail } from "@metriport/shared";
import { SQSEvent } from "aws-lambda";
import { z } from "zod";
import { capture } from "../../shared/capture";
import { prefixedLog } from "../../shared/log";
import { parseBody } from "../../shared/parse-body";
import { getSingleMessageOrFail } from "../../shared/sqs";

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

  const { cxId, jobId } = parseBody(snowflakeConnectorTriggerSchema, message.body);

  const log = prefixedLog(`cxId ${cxId}`);
  const isSnowflakeIngestionEnabled = await isDatawarehouseSnowflakeEnabledForCx(cxId);
  if (!isSnowflakeIngestionEnabled) {
    log(`Datawarehouse Snowflake ingestion is not enabled for cx ${cxId}, skipping...`);
    return;
  }

  const snowflakeHandler = new SnowflakeIngestorBatch();
  await snowflakeHandler.ingestCoreIntoSnowflake({ cxId, coreExportJobId: jobId });
});

const snowflakeConnectorTriggerSchema = z.union([
  z.object({
    cxId: z.string(),
    jobId: z.string(),
    eventType: z.literal(EXPORT_CORE_FROM_FWH_TO_S3_COMPLETE_EVENT_TYPE),
  }),
  z.object({
    cxId: z.string(),
    jobId: z.string(),
  }),
]);
