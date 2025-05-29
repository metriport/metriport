import { GetAppointmentsRequest } from "@metriport/core/external/ehr/command/get-appointments/ehr-get-appointments";
import { EhrGetAppointmentsDirect } from "@metriport/core/external/ehr/command/get-appointments/ehr-get-appointments-direct";
import { MetriportError } from "@metriport/shared";
import { SQSEvent } from "aws-lambda";
import { capture } from "./shared/capture";
import { ehrGetAppointmentsSchema } from "./shared/ehr";
import { getEnvOrFail } from "./shared/env";
import { prefixedLog } from "./shared/log";
import { getSingleMessageOrFail } from "./shared/sqs";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");

// TODO move to capture.wrapHandler()
export const handler = capture.wrapHandler(async (event: SQSEvent) => {
  capture.setExtra({ event, context: lambdaName });

  const startedAt = new Date().getTime();
  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;

  console.log(`Running with unparsed body: ${message.body}`);
  const parsedBody = parseBody(message.body);
  const { method, cxId, practiceId } = parsedBody;

  const log = prefixedLog(`method ${method}, cxId ${cxId}, practiceId ${practiceId}`);
  log(`Parsed: ${JSON.stringify(parsedBody)}`);

  const ehrGetAppointmentsHandler = new EhrGetAppointmentsDirect();
  const appointments = await ehrGetAppointmentsHandler.getAppointments(parsedBody);

  const finishedAt = new Date().getTime();
  log(`Done local duration: ${finishedAt - startedAt}ms`);
  return appointments;
});

function parseBody(body?: unknown): GetAppointmentsRequest {
  if (!body) throw new MetriportError(`Missing message body`);

  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new MetriportError(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  return ehrGetAppointmentsSchema.parse(bodyAsJson);
}
