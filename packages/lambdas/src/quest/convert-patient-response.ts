import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { questPatientResponseSchema } from "@metriport/core/external/quest/command/convert-patient-response/convert-patient-response";
import { QuestConvertPatientResponseHandlerDirect } from "@metriport/core/external/quest/command/convert-patient-response/convert-patient-response-direct";
import { Config } from "@metriport/core/util/config";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { SQSEvent } from "aws-lambda";
import { capture } from "../shared/capture";
import { prefixedLog } from "../shared/log";
import { parseBody } from "../shared/parse-body";
import { getSingleMessageOrFail } from "../shared/sqs";

capture.init();

FeatureFlags.init(Config.getAWSRegion(), Config.getFeatureFlagsTableName());

// Automatically set by AWS
const lambdaName = getEnvVarOrFail("AWS_LAMBDA_FUNCTION_NAME");

export const handler = capture.wrapHandler(async (event: SQSEvent) => {
  capture.setExtra({ event, context: lambdaName });

  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;

  const patientResponse = parseBody(questPatientResponseSchema, message.body);

  const log = prefixedLog("quest.convert-patient-response");
  log("Starting conversion of Quest patient response");
  const handler = new QuestConvertPatientResponseHandlerDirect();
  await handler.convertQuestPatientResponse(patientResponse);
  log("Conversion of Quest patient response completed");
});
