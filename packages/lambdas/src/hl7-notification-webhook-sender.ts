import { Hl7Notification } from "@metriport/core/command/hl7-notification/hl7-notification-webhook-sender";
import { SQSEvent } from "aws-lambda";
import { Hl7NotificationWebhookSenderDirect } from "@metriport/core/command/hl7-notification/hl7-notification-webhook-sender-direct";
import { capture } from "./shared/capture";
import * as Sentry from "@sentry/serverless";
import { getSingleMessageOrFail } from "./shared/sqs";
import { getEnvOrFail } from "./shared/env";
import { z } from "zod";
import { prefixedLog } from "./shared/log";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");

export const handler = Sentry.AWSLambda.wrapHandler(async (event: SQSEvent): Promise<void> => {
  const params = getSingleMessageOrFail(event.Records, lambdaName);
  if (!params) {
    throw new Error("No message found in SQS event");
  }

  const log = prefixedLog(lambdaName);
  log(`Parsing body: ${params.body}`);
  const parsedBody = parseBody(params.body);
  const { cxId, patientId } = parsedBody;

  capture.setExtra({
    cxId,
    patientId,
    context: "hl7-notification-webhook-sender-cloud.execute",
  });

  await new Hl7NotificationWebhookSenderDirect().execute(parsedBody);
});

const parseBody = (body: string): Hl7Notification => {
  const schema = z.object({
    cxId: z.string().uuid(),
    patientId: z.string().uuid(),
    message: z.string(),
    messageReceivedTimestamp: z.string(),
  });

  const parsed = schema.safeParse(JSON.parse(body));
  if (!parsed.success) {
    throw new Error(`Invalid HL7 notification payload: ${parsed.error.message}`);
  }

  return parsed.data;
};
