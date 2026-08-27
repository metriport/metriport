import { CoreToHedisBatch } from "@metriport/core/command/analytics-platform/core-to-hedis/command/core-to-hedis-batch";
import { coreDbSchema } from "@metriport/core/command/analytics-platform/fwh/utils";
import { RAW_TO_CORE_COMPLETE_EVENT_TYPE } from "@metriport/core/command/analytics-platform/raw-to-core/command/raw-to-core";
import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { Config } from "@metriport/core/util/config";
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
const coreToHedisBatchJobQueueArn = Config.getCoreToHedisBatchJobQueueArn();
const coreToHedisBatchJobDefinitionArn = Config.getCoreToHedisBatchJobDefinitionArn();
const featureFlagsTableName = getEnvVarOrFail("FEATURE_FLAGS_TABLE_NAME");

FeatureFlags.init(region, featureFlagsTableName);

export const handler = capture.wrapHandler(async (event: SQSEvent) => {
  capture.setExtra({ event });

  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;

  const { cxId, database } = parseBody(coreToHedisTriggerSchema, message.body);

  const coreToHedisHandler = new CoreToHedisBatch(
    coreDbSchema,
    coreToHedisBatchJobQueueArn,
    coreToHedisBatchJobDefinitionArn
  );
  await coreToHedisHandler.processCoreToHedis({
    cxId,
    database,
  });
});

const coreToHedisTriggerSchema = z.union([
  z.object({
    cxId: z.string(),
    database: z.string(),
    eventType: z.literal(RAW_TO_CORE_COMPLETE_EVENT_TYPE),
  }),
  z.object({
    cxId: z.string(),
    database: z.string(),
  }),
]);
