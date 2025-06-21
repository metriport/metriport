import { SurescriptsSendBatchRequestHandlerDirect } from "@metriport/core/external/surescripts/command/send-batch-request/send-batch-request-direct";
import { SurescriptsBatchRequest } from "@metriport/core/external/surescripts/types";
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

  const parsedBody = parseBody<SurescriptsBatchRequest>(
    surescriptsBatchRequestSchema,
    message.body
  );
  const client = await makeSurescriptsClient();
  const sendBatchRequestHandler = new SurescriptsSendBatchRequestHandlerDirect(client);
  await sendBatchRequestHandler.sendBatchRequest(parsedBody);
});

const surescriptsBatchRequestSchema = z.object({
  patientIds: z.string().array(),
  cxId: z.string(),
  facilityId: z.string(),
});
