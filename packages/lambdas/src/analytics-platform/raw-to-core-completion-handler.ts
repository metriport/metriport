import {
  RAW_TO_CORE_COMPLETE_EVENT_TYPE,
  RawToCoreCompletionMessage,
} from "@metriport/core/command/analytics-platform/raw-to-core/command/raw-to-core";
import {
  AnalyticsEventType,
  sendAnalyticsEvent,
} from "@metriport/core/command/analytics-platform/utils";
import { addCxToFeatureFlag } from "@metriport/core/command/feature-flags/domain-ffs";
import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { out } from "@metriport/core/util/log";
import { errorToString, getEnvVarOrFail } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { EventBridgeEvent } from "aws-lambda";
import { capture } from "../shared/capture";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvVarOrFail("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvVarOrFail("AWS_REGION");
// Set by us
const rawToCoreCompletionTopicArn = getEnvVarOrFail("RAW_TO_CORE_COMPLETION_TOPIC_ARN");
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

    const { log } = out(`RawToCoreCompletionHandler - job ${detail.jobId}`);

    // Use the database parameter as the message group ID for FIFO ordering
    // Falls back to jobId if database is not available
    const cxId = parameters?.cxId;
    const database = parameters?.database;
    const jobId = parameters?.jobId;
    const fullRefresh = parameters?.fullRefresh;
    if (!cxId || !database || !jobId || fullRefresh === undefined || fullRefresh === "") {
      throw new Error("cxId, database, jobId, and fullRefresh are required");
    }

    if (fullRefresh === "true") {
      try {
        await addCxToFeatureFlag({
          featureFlagName: "cxsWithAnalyticsIncrementalRawToCore",
          cxId,
        });
      } catch (error) {
        const msg = `Failed to add cx to feature flag`;
        log(`${msg}: ${errorToString(error)}`);
        capture.error(msg, {
          extra: {
            error: errorToString(error),
            cxId,
            jobId,
          },
        });
      }
    }

    const messageGroupId = cxId;

    const message: RawToCoreCompletionMessage = {
      cxId,
      jobId,
      database,
      eventType: RAW_TO_CORE_COMPLETE_EVENT_TYPE,
      timestamp: buildDayjs().toISOString(),
    };

    await sendAnalyticsEvent({
      eventType: AnalyticsEventType.RAW_TO_CORE_COMPLETE,
      topicArn: rawToCoreCompletionTopicArn,
      message,
      subject: `Raw to Core Complete - ${cxId}`,
      log,
      messageGroupId,
      messageDeduplicationId: jobId,
    });

    log(`Raw to Core completion message sent for job ${jobId} cx ${cxId}`);
  }
);
