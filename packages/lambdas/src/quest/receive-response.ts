import { QuestReceiveResponseHandlerDirect } from "@metriport/core/external/quest/command/receive-response/receive-response-direct";
import { SQSEvent } from "aws-lambda";
import { z } from "zod";
import { capture } from "../shared/capture";
import { getEnvOrFail } from "../shared/env";
import { parseBody } from "../shared/parse-body";
import { getSingleMessageOrFail } from "../shared/sqs";
import { buildQuestClient } from "./shared";

capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");

export const handler = capture.wrapHandler(async (event: SQSEvent) => {
  capture.setExtra({ event, context: lambdaName });
  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;

  const parsedBody = parseBody(questReceiveResponseSchema, message.body);
  const client = await buildQuestClient();
  const receiveResponseHandler = new QuestReceiveResponseHandlerDirect(client);
  await receiveResponseHandler.receiveResponse(parsedBody);
});

const questReceiveResponseSchema = z.object({
  cxId: z.string(),
  facilityId: z.string(),
  populationId: z.string(),
  patientIdMap: z.record(z.string(), z.string()),
});
