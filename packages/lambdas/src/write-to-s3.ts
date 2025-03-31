import { WriteToS3Request } from "@metriport/core/command/write-to-storage/s3/write-to-s3";
import { S3WriterLocal } from "@metriport/core/command/write-to-storage/s3/write-to-s3-local";
import { MetriportError } from "@metriport/shared";
import * as Sentry from "@sentry/serverless";
import { SQSEvent } from "aws-lambda";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { prefixedLog } from "./shared/log";
import { parseWriteToS3 } from "./shared/write-to-storage";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");

export const handler = Sentry.AWSLambda.wrapHandler(async (event: SQSEvent) => {
  const log = prefixedLog(`write-to-s3`);
  capture.setExtra({
    event,
    context: lambdaName,
  });
  const messages = event.Records;
  if (messages.length < 1) return;
  log(`Running with unparsed bodies: ${messages.map(m => m.body).join(", ")}`);
  const parsedBodies = messages.map(m => parseBody(m.body));

  const services = new Set(parsedBodies.map(m => m.serviceId));
  if (services.size > 1) {
    throw new MetriportError(`Multiple services found in batch`, undefined, {
      services: JSON.stringify(services),
    });
  }

  const s3Writer = new S3WriterLocal();
  await s3Writer.writeToS3(parsedBodies);
});

function parseBody(body?: unknown): WriteToS3Request[number] {
  if (!body) throw new MetriportError(`Missing message body`);

  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new MetriportError(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  return parseWriteToS3(bodyAsJson);
}
