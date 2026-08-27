import { CONNECTOR_INGESTION_COMPLETE_EVENT_TYPE } from "@metriport/core/command/analytics-platform/connectors/utils";
import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { errorToString, getEnvVarOrFail } from "@metriport/shared";
import { SQSEvent } from "aws-lambda";
import { z } from "zod";
import { capture } from "../shared/capture";
import { prefixedLog } from "../shared/log";
import { parseBody } from "../shared/parse-body";
import { getSingleMessageOrFail } from "../shared/sqs";

// Keep this as early on the file as possible
capture.init();

/**
 * Lambda to consume analytics platform events and send webhooks to customers.
 *
 * It's triggered by SQS queue with messages about:
 * - Core rebuild completion
 * - Core exported to S3
 * - Connector ingestion complete (e.g., Snowflake)
 *
 * For each event, it looks up the customer's webhook URL and sends a webhook notification.
 */

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

  try {
    console.log(`Processing message: ${JSON.stringify(message.body)}`);
    const parsedBody = parseBody(analyticsEventSchema, message.body);
    const { cxId, eventType } = parsedBody;

    const log = prefixedLog(`cxId ${cxId} eventType ${eventType}`);
    log(`Parsed: ${JSON.stringify(parsedBody)}`);

    log(`TODO: Webhook sent successfully`);
  } catch (error) {
    console.error("Re-throwing error ", errorToString(error));
    throw error;
  }
});

const analyticsEventSchema = z.object({
  cxId: z.string(),
  jobId: z.string(),
  eventType: z.literal(CONNECTOR_INGESTION_COMPLETE_EVENT_TYPE),
  connector: z.string(),
});
