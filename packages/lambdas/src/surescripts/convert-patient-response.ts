import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { surescriptsPatientResponseSchema } from "@metriport/core/external/surescripts/command/convert-patient-response/convert-patient-response";
import { SurescriptsConvertPatientResponseHandlerDirect } from "@metriport/core/external/surescripts/command/convert-patient-response/convert-patient-response-direct";
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

  const patientResponse = parseBody(surescriptsPatientResponseSchema, message.body);

  const log = prefixedLog("surescripts.convert-patient-response");
  log("Starting conversion of Surescripts patient response");
  const convertPatientResponseHandler = new SurescriptsConvertPatientResponseHandlerDirect();
  await convertPatientResponseHandler.convertPatientResponse(patientResponse);
  log("Conversion of Surescripts patient response completed");
});
