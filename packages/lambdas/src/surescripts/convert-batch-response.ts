import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { surescriptsBatchResponseSchema } from "@metriport/core/external/surescripts/command/convert-batch-response/convert-batch-response";
import { SurescriptsConvertBatchResponseHandlerDirect } from "@metriport/core/external/surescripts/command/convert-batch-response/convert-batch-response-direct";
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

  const batchResponse = parseBody(surescriptsBatchResponseSchema, message.body);

  const log = prefixedLog("surescripts.convert-batch-response");
  log("Starting conversion of Surescripts batch response");
  const convertBatchHandler = new SurescriptsConvertBatchResponseHandlerDirect();
  await convertBatchHandler.convertBatchResponse(batchResponse);
  log("Conversion of Surescripts batch response completed");
});
