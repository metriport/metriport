import { SurescriptsReceiveVerificationHandlerDirect } from "@metriport/core/external/surescripts/command/receive-verification/receive-verification-direct";
import { SQSEvent } from "aws-lambda";
import { z } from "zod";
import { capture } from "../shared/capture";
import { getEnvOrFail } from "../shared/env";
import { getSingleMessageOrFail, parseBody } from "../shared/sqs";
import { makeSurescriptsClient } from "./shared";

capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");

export const handler = capture.wrapHandler(async (event: SQSEvent) => {
  capture.setExtra({ event, context: lambdaName });
  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;

  const parsedBody = parseBody(surescriptsReceiveVerificationSchema, message.body);
  const client = await makeSurescriptsClient();
  const receiveVerificationHandler = new SurescriptsReceiveVerificationHandlerDirect(client);
  await receiveVerificationHandler.receiveVerification(parsedBody);
});

const surescriptsReceiveVerificationSchema = z.object({
  transmissionId: z.string(),
});
