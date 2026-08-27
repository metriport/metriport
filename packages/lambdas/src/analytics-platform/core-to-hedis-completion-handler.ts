import {
  CORE_TO_HEDIS_COMPLETE_EVENT_TYPE,
  CoreToHedisCompletionMessage,
} from "@metriport/core/command/analytics-platform/core-to-hedis/command/core-to-hedis";
import {
  AnalyticsEventType,
  sendAnalyticsEvent,
} from "@metriport/core/command/analytics-platform/utils";
import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { out } from "@metriport/core/util/log";
import { getEnvVarOrFail } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { EventBridgeEvent } from "aws-lambda";
import { capture } from "../shared/capture";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvVarOrFail("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvVarOrFail("AWS_REGION");
// Set by us
const coreToHedisCompletionTopicArn = getEnvVarOrFail("CORE_TO_HEDIS_COMPLETION_TOPIC_ARN");
const featureFlagsTableName = getEnvVarOrFail("FEATURE_FLAGS_TABLE_NAME");

FeatureFlags.init(region, featureFlagsTableName);

type BatchJobStateChangeDetail = {
  jobArn: string;
  jobName: string;
  jobId: string;
  jobQueue: string;
  status: string;
  statusReason?: string;
  jobDefinition: string;
  parameters?: Record<string, string>;
  container?: {
    exitCode?: number;
  };
};

export const handler = capture.wrapHandler(
  async (event: EventBridgeEvent<"Batch Job State Change", BatchJobStateChangeDetail>) => {
    capture.setExtra({ event, context: lambdaName });

    const { detail } = event;
    const { parameters } = detail;

    const { log } = out(`CoreToHedisCompletionHandler - job ${detail.jobId}`);

    // Use the database parameter as the message group ID for FIFO ordering
    // Falls back to jobId if database is not available
    const cxId = parameters?.cxId;
    const database = parameters?.database;
    const jobId = parameters?.jobId;
    if (!cxId || !database || !jobId) {
      throw new Error("cxId and database are required");
    }

    const messageGroupId = cxId;

    const message: CoreToHedisCompletionMessage = {
      cxId,
      jobId,
      database,
      eventType: CORE_TO_HEDIS_COMPLETE_EVENT_TYPE,
      timestamp: buildDayjs().toISOString(),
    };

    await sendAnalyticsEvent({
      eventType: AnalyticsEventType.CORE_TO_HEDIS_COMPLETE,
      topicArn: coreToHedisCompletionTopicArn,
      message,
      subject: `Core to HEDIS Complete - ${cxId}`,
      log,
      messageGroupId,
      messageDeduplicationId: jobId,
    });

    log(`Core to HEDIS completion message sent for job ${jobId} cx ${cxId}`);
  }
);
