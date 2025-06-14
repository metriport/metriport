import { SurescriptsReceiveResponseHandlerDirect } from "@metriport/core/external/surescripts/command/receive-response/receive-response-direct";
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

  const parsedBody = parseBody(surescriptsReceiveResponseSchema, message.body);
  const client = await makeSurescriptsClient();
  const receiveResponseHandler = new SurescriptsReceiveResponseHandlerDirect(client);
  await receiveResponseHandler.receiveResponse(parsedBody);
});

const surescriptsReceiveResponseSchema = z.object({
  transmissionId: z.string(),
  populationId: z.string(),
});
