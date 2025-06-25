import { SurescriptsVerifyRequestInHistoryHandlerDirect } from "@metriport/core/external/surescripts/command/verify-request-in-history/verify-request-in-history-direct";
import { SQSEvent } from "aws-lambda";
import { z } from "zod";
import { capture } from "../shared/capture";
import { getEnvOrFail } from "../shared/env";
import { parseBody } from "../shared/parse-body";
import { getSingleMessageOrFail } from "../shared/sqs";
import { makeSurescriptsClient } from "./shared";

capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");

export const handler = capture.wrapHandler(async (event: SQSEvent) => {
  capture.setExtra({ event, context: lambdaName });
  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;

  const parsedBody = parseBody(surescriptsVerifyRequestInHistorySchema, message.body);
  const client = await makeSurescriptsClient();
  const verifyRequestInHistoryHandler = new SurescriptsVerifyRequestInHistoryHandlerDirect(client);
  await verifyRequestInHistoryHandler.verifyRequestInHistory(parsedBody);
});

const surescriptsVerifyRequestInHistorySchema = z.object({
  transmissionId: z.string(),
});
