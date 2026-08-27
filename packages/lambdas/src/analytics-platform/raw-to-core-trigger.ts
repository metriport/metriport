import {
  appendFdwSchemaSuffix,
  rawDbSchema,
} from "@metriport/core/command/analytics-platform/fwh/utils";
import { RawToCoreBatch } from "@metriport/core/command/analytics-platform/raw-to-core/command/raw-to-core-batch";
import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { Config } from "@metriport/core/util/config";
import { getEnvVarOrFail } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { SQSEvent } from "aws-lambda";
import dayjs from "dayjs";
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
const rawToCoreBatchJobQueueArn = Config.getRawToCoreBatchJobQueueArn();
const rawToCoreBatchJobDefinitionArn = Config.getRawToCoreBatchJobDefinitionArn();
const featureFlagsTableName = getEnvVarOrFail("FEATURE_FLAGS_TABLE_NAME");

FeatureFlags.init(region, featureFlagsTableName);

export const handler = capture.wrapHandler(async (event: SQSEvent) => {
  capture.setExtra({ event, context: lambdaName });

  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;

  const { cxId, database, fullRefresh, lookbackTimestamp, lookbackHours, delay } = parseBody(
    rawToCoreTriggerSchema,
    message.body
  );

  const rawToCoreHandler = new RawToCoreBatch(
    appendFdwSchemaSuffix(rawDbSchema),
    rawToCoreBatchJobQueueArn,
    rawToCoreBatchJobDefinitionArn
  );
  await rawToCoreHandler.processRawToCore({
    cxId,
    database,
    ...(fullRefresh && { fullRefresh }),
    ...(lookbackTimestamp && { lookbackTimestamp: buildDayjs(lookbackTimestamp) }),
    ...(lookbackHours && { lookbackHours }),
    ...(delay && { delay: dayjs.duration(delay, "milliseconds") }),
  });
});

const rawToCoreTriggerSchema = z.object({
  cxId: z.string(),
  database: z.string(),
  fullRefresh: z.boolean().optional(),
  lookbackTimestamp: z.string().optional(),
  lookbackHours: z.number().optional(),
  delay: z.number().optional(),
});
