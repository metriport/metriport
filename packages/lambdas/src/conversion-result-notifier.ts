import { ConversionResult } from "@metriport/core/command/conversion-result/types";
import { sendConversionResults } from "@metriport/core/command/conversion-result/send-multiple-conversion-results";
import { getEnvVarOrFail, MetriportError } from "@metriport/shared";
import * as Sentry from "@sentry/serverless";
import { SQSEvent } from "aws-lambda";
import { z } from "zod";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { out } from "@metriport/core/util/log";
// Keep this as early on the file as possible
capture.init();

const lambdaName = getEnvVarOrFail("AWS_LAMBDA_FUNCTION_NAME");
const apiUrl = getEnvOrFail("API_URL");

// TODO move to capture.wrapHandler()
export const handler = Sentry.AWSLambda.wrapHandler(async (event: SQSEvent) => {
  const { log } = out(``);
  log(`Running with ${event.Records.length} records`);
  capture.setExtra({ lambdaName, event });

  const records = event.Records;
  if (!records || records.length < 1) {
    log(`No records, discarding this event: ${JSON.stringify(event)}`);
    return;
  }
  const parsedRecords = records.map(r => parseBody(r.body));
  log(`Processing ${parsedRecords.length} records...`);

  await sendConversionResults({ results: parsedRecords, apiUrl });

  log(`Done`);
});

const processConversionResultSchema = z.object({
  cxId: z.string(),
  patientId: z.string(),
  status: z.enum(["success", "failed"]),
  details: z.string().optional(),
  jobId: z.string().optional(),
  source: z.string().optional(),
});

function parseBody(body?: unknown): ConversionResult {
  if (!body) throw new MetriportError(`Missing message body`);
  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new MetriportError(`Invalid body`);
  const bodyAsJson = JSON.parse(bodyString);
  return processConversionResultSchema.parse(bodyAsJson);
}
