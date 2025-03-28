import {
  bulkServices,
  ProcessWriteToS3Handler,
  ProcessWriteToS3Request,
} from "@metriport/core/command/write-to-storage/s3/write-to-s3";
import { ProcessWriteToS3Local } from "@metriport/core/command/write-to-storage/s3/write-to-s3-local";
import { errorToString, MetriportError } from "@metriport/shared";
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
  try {
    const startedAt = new Date().getTime();
    const messages = event.Records;
    if (messages.length < 1) return;

    console.log(`Running with unparsed bodies: ${messages.map(m => m.body).join(", ")}`);
    const parsedBodies = messages.map(m => parseBody(m.body));
    const messagesByService = parsedBodies.reduce((acc, body) => {
      const serviceId = body.serviceId;
      const serviceArray = acc[serviceId] ?? [];
      serviceArray.push(body);
      acc[serviceId] = serviceArray;
      return acc;
    }, {} as Record<string, ProcessWriteToS3Request[]>);

    const writeToS3Handler = new ProcessWriteToS3Local();
    await Promise.all(
      Object.entries(messagesByService).flatMap(([serviceId, messages]) => {
        const log = prefixedLog(`serviceId ${serviceId}`);
        if (bulkServices.includes(serviceId)) {
          log(`Bulk processing ${messages.length} messages for service ${serviceId}`);
          return processBulkService({
            serviceId,
            messages,
            handler: writeToS3Handler,
          });
        }
        log(`Processing ${messages.length} messages for service ${serviceId}`);
        return messages.map(m => writeToS3Handler.processWriteToS3(m));
      })
    );
    const finishedAt = new Date().getTime();
    console.log(`Done local duration: ${finishedAt - startedAt}ms`);
  } catch (error) {
    const msg = "Error processing event on " + lambdaName;
    console.log(`${msg}: ${errorToString(error)}`);
    capture.setExtra({
      event,
      context: lambdaName,
      error,
    });
    throw new MetriportError(msg, error);
  }
});

function parseBody(body?: unknown): ProcessWriteToS3Request {
  if (!body) throw new MetriportError(`Missing message body`);

  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new MetriportError(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  return parseWriteToS3(bodyAsJson);
}

function processBulkService({
  serviceId,
  messages,
  handler,
}: {
  serviceId: string;
  messages: ProcessWriteToS3Request[];
  handler: ProcessWriteToS3Handler;
}): Promise<void>[] {
  const log = prefixedLog(`processBulkService - serviceId ${serviceId}`);
  const buckets = new Set(...messages.map(m => m.bucket));
  if (buckets.size > 1) throw new MetriportError(`Multiple buckets for service ${serviceId}`);
  const bucket = buckets.values().next().value;
  const messagesByServiceAndFilePath = messages.reduce((acc, message) => {
    const filePath = message.filePath;
    const serviceArray = acc[filePath] ?? [];
    serviceArray.push(message);
    acc[filePath] = serviceArray;
    return acc;
  }, {} as Record<string, ProcessWriteToS3Request[]>);
  log(
    `Processing ${messages.length} messages for service ${serviceId} -- input keys and metadata will be ignored`
  );
  return Object.entries(messagesByServiceAndFilePath).map(([filePath, messages]) =>
    handler.processWriteToS3({
      serviceId,
      bucket,
      filePath,
      payload: messages.map(m => m.payload).join("\n"),
      contentType: "application/json",
    })
  );
}
