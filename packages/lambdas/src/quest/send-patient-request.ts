import { QuestSendPatientRequestHandlerDirect } from "@metriport/core/external/quest/command/send-patient-request/send-patient-request-direct";
import { QuestPatientRequest } from "@metriport/core/external/quest/types";
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

  const parsedBody = parseBody<QuestPatientRequest>(questPatientRequestSchema, message.body);
  const client = await buildQuestClient();
  const sendPatientRequestHandler = new QuestSendPatientRequestHandlerDirect(client);
  await sendPatientRequestHandler.sendPatientRequest(parsedBody);
});

const questPatientRequestSchema = z.object({
  patientId: z.string(),
  cxId: z.string(),
  facilityId: z.string(),
});
