import { Hl7Notification } from "@metriport/core/command/hl7-notification/hl7-notification-webhook-sender";
import { Hl7NotificationWebhookSenderDirect } from "@metriport/core/command/hl7-notification/hl7-notification-webhook-sender-direct";
import { SQSEvent } from "aws-lambda";
import { z } from "zod";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { prefixedLog } from "./shared/log";
import { getSingleMessageOrFail } from "./shared/sqs";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
const oldBucketName = getEnvOrFail("HL7_OUTGOING_MESSAGE_BUCKET_NAME");
const bucketName = getEnvOrFail("HL7_CONVERSION_BUCKET_NAME");
const apiUrl = getEnvOrFail("API_URL");

// TODO move to capture.wrapHandler()
export const handler = capture.wrapHandler(async (event: SQSEvent): Promise<void> => {
  const params = getSingleMessageOrFail(event.Records, lambdaName);
  if (!params) {
    throw new Error("No message found in SQS event");
  }

  const log = prefixedLog(lambdaName);
  log("Parsing body");
  const parsedBody = parseBody(params.body);
  const { cxId, patientId } = parsedBody;

  capture.setExtra({
    cxId,
    patientId,
    context: "hl7-notification-webhook-sender-cloud.execute",
  });

  await new Hl7NotificationWebhookSenderDirect(apiUrl, oldBucketName, bucketName).execute(
    parsedBody
  );
});

const parseBody = (body: string): Hl7Notification => {
  const schema = z.object({
    cxId: z.string().uuid(),
    patientId: z.string().uuid(),
    message: z.string(),
    sourceTimestamp: z.string(),
    messageReceivedTimestamp: z.string(),
  });

  return schema.parse(JSON.parse(body));
};
