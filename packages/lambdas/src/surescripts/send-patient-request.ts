import { SurescriptsSendPatientRequestHandlerDirect } from "@metriport/core/external/surescripts/command/send-patient-request/send-patient-request-direct";
import { SurescriptsPatientRequest } from "@metriport/core/external/surescripts/types";
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

  const parsedBody = parseBody<SurescriptsPatientRequest>(
    surescriptsPatientRequestSchema,
    message.body
  );
  const client = await makeSurescriptsClient();
  const handler = new SurescriptsSendPatientRequestHandlerDirect(client);
  await handler.sendPatientRequest(parsedBody);
});

const surescriptsPatientRequestSchema = z.object({
  patientId: z.string(),
  cxId: z.string(),
  facilityId: z.string(),
});
