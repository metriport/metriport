import { hl7NotificationSenderParamsSchema } from "@metriport/core/command/hl7-notification/hl7-notification-webhook-sender";
import { Hl7NotificationWebhookSenderDirect } from "@metriport/core/command/hl7-notification/hl7-notification-webhook-sender-direct";
import { SQSEvent } from "aws-lambda";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { prefixedLog } from "./shared/log";
import { getSingleMessageOrFail } from "./shared/sqs";
import { getSecretValueOrFail } from "@metriport/core/external/aws/secret-manager";
import { Config } from "@metriport/core/util/config";
import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";

// Keep this as early on the file as possible
capture.init();
FeatureFlags.init(Config.getAWSRegion(), Config.getFeatureFlagsTableName());

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
const apiUrl = getEnvOrFail("API_URL");

export const handler = capture.wrapHandler(async (event: SQSEvent): Promise<void> => {
  const scramblerSecretArn = Config.getHl7Base64ScramblerSeedArn();
  const scramblerSecret = await getSecretValueOrFail(scramblerSecretArn, Config.getAWSRegion());
  process.env["HL7_BASE64_SCRAMBLER_SEED"] = scramblerSecret;

  const params = getSingleMessageOrFail(event.Records, lambdaName);
  if (!params) {
    throw new Error("No message found in SQS event");
  }

  const log = prefixedLog(lambdaName);
  log("Parsing body");
  const parsedBody = hl7NotificationSenderParamsSchema.parse(JSON.parse(params.body));
  const { cxId, patientId } = parsedBody;

  capture.setExtra({
    cxId,
    patientId,
    context: "hl7-notification-webhook-sender-cloud.execute",
  });

  await new Hl7NotificationWebhookSenderDirect(apiUrl).execute(parsedBody);
});
