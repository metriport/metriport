import { dbCredsSchema, errorToString } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { EventEmitter } from "events";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import { SNSClient } from "../../external/aws/sns";
import { Config } from "../../util/config";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const nanoid = customAlphabet(alphabet, 10);

/**
 * Generates a unique job ID for analytics platform operations.
 * Format: YYYYMMDD-HHmmss-<random 10 char alphanumeric>
 */
export function generateJobId(): string {
  return (
    buildDayjs().toISOString().replace(/[-:.]/g, "").replace("T", "-").substring(0, 18) +
    "-" +
    nanoid()
  );
}

export const dbCredsForLambdaSchema = dbCredsSchema.omit({ password: true }).merge(
  z.object({
    passwordSecretArn: z.string(),
  })
);
export type DatabaseCredsForLambda = z.infer<typeof dbCredsForLambdaSchema>;

export type SendAnalyticsNotificationParams<T> = {
  topicArn: string | undefined;
  message: T;
  subject: string;
  log: (msg: string) => void;
  /** Required for FIFO topics. Used to ensure messages are processed in order within the group. */
  messageGroupId?: string;
  /** Required for FIFO topics without content-based deduplication. Used to prevent duplicate messages. */
  messageDeduplicationId?: string;
};

/**
 * Sends an SNS notification for analytics platform events.
 * If topicArn is not provided, the notification is skipped.
 *
 * @param topicArn - The ARN of the SNS topic to publish to
 * @param message - The message payload to send (will be JSON stringified)
 * @param subject - The subject line for the notification
 * @param log - Logger function for logging
 * @param messageGroupId - Required for FIFO topics. Used for message ordering.
 * @param messageDeduplicationId - Required for FIFO topics. Used for deduplication.
 */
export async function sendAnalyticsNotification<T>({
  topicArn,
  message,
  subject,
  log,
  messageGroupId,
  messageDeduplicationId,
}: SendAnalyticsNotificationParams<T>): Promise<void> {
  if (!topicArn) {
    log("No topic ARN configured, skipping notification");
    return;
  }

  const snsClient = new SNSClient();

  try {
    await snsClient.publish({
      topicArn,
      message: JSON.stringify(message),
      subject,
      ...(messageGroupId && { messageGroupId }),
      ...(messageDeduplicationId && { messageDeduplicationId }),
    });
    log(`Sent notification: ${subject}`);
  } catch (error) {
    log(`Failed to send notification: ${errorToString(error)}`);
    throw error;
  }
}

/**
 * Analytics event types for local development event emitter.
 */
export const AnalyticsEventType = {
  EXPORT_CORE_FROM_FWH_TO_S3_COMPLETE: "export-core-from-fwh-to-s3-complete",
  CONNECTOR_INGESTION_COMPLETE: "connector-ingestion-complete",
  RAW_TO_CORE_COMPLETE: "raw-to-core-complete",
  CORE_TO_HEDIS_COMPLETE: "core-to-hedis-complete",
} as const;

export type AnalyticsEventType = (typeof AnalyticsEventType)[keyof typeof AnalyticsEventType];

/**
 * Event emitter for local development analytics events.
 * In dev environments, this is used instead of SNS to simulate the event-driven architecture.
 */
export const analyticsEventEmitter = new EventEmitter();

export type SendAnalyticsEventParams<T> = {
  eventType: AnalyticsEventType;
  topicArn: string | undefined;
  message: T;
  subject: string;
  log: (msg: string) => void;
  /** Required for FIFO topics. Used to ensure messages are processed in order within the group. */
  messageGroupId?: string;
  /** Required for FIFO topics without content-based deduplication. Used to prevent duplicate messages. */
  messageDeduplicationId?: string;
};

/**
 * Sends an analytics event notification.
 * - In dev/local environments: Emits a node event via the analyticsEventEmitter
 * - In cloud environments: Publishes to the specified SNS topic
 *
 * @param eventType - The type of analytics event (used for local event emitter)
 * @param topicArn - The ARN of the SNS topic to publish to (cloud only)
 * @param message - The message payload to send
 * @param subject - The subject line for the notification
 * @param log - Logger function for logging
 * @param messageGroupId - Required for FIFO topics. Used for message ordering.
 * @param messageDeduplicationId - Required for FIFO topics. Used for deduplication.
 */
export async function sendAnalyticsEvent<T>({
  eventType,
  topicArn,
  message,
  subject,
  log,
  messageGroupId,
  messageDeduplicationId,
}: SendAnalyticsEventParams<T>): Promise<void> {
  if (Config.isDev()) {
    log(`[DEV] Emitting local event: ${eventType}`);
    analyticsEventEmitter.emit(eventType, message);
    log(`[DEV] Emitted event: ${eventType} - ${subject}`);
    return;
  }

  await sendAnalyticsNotification({
    topicArn,
    message,
    subject,
    log,
    ...(messageGroupId && { messageGroupId }),
    ...(messageDeduplicationId && { messageDeduplicationId }),
  });
}
