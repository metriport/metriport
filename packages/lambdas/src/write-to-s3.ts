import { WriteToS3Request } from "@metriport/core/command/write-to-storage/s3/write-to-s3";
import { S3WriterLocal } from "@metriport/core/command/write-to-storage/s3/write-to-s3-local";
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
  const log = prefixedLog(`write-to-s3`);
  try {
    const startedAt = new Date().getTime();
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
    const serviceId = services.values().next().value;
    const buckets = new Set(parsedBodies.map(m => m.bucket));
    if (buckets.size > 1) {
      throw new MetriportError(`Multiple buckets for service ${serviceId}`, undefined, {
        buckets: JSON.stringify(buckets),
      });
    }
    const bucket = buckets.values().next().value;

    const messagesByFilePath = parsedBodies.reduce(
      (acc, body) => {
        const filePath = body.filePath;
        const singleMessages = acc[filePath]?.singleMessages ?? [];
        const bulkMessages = acc[filePath]?.bulkMessages ?? [];
        (body.fileName ? singleMessages : bulkMessages).push(body);
        acc[filePath] = {
          singleMessages,
          bulkMessages,
        };
        return acc;
      },
      {} as Record<
        string,
        {
          singleMessages: WriteToS3Request[];
          bulkMessages: WriteToS3Request[];
        }
      >
    );

    const s3Writer = new S3WriterLocal();
    await Promise.all(
      Object.entries(messagesByFilePath).flatMap(([filePath, messagesMap]) => {
        const log = prefixedLog(`serviceId ${serviceId}`);
        log(`ing ${messages.length} messages for service ${serviceId}`);
        return [
          ...messagesMap.singleMessages.map(m => s3Writer.writeToS3(m)),
          s3Writer.writeToS3({
            serviceId,
            bucket,
            filePath,
            payload: messagesMap.bulkMessages.map(m => m.payload).join("\n"),
          }),
        ];
      })
    );
    const finishedAt = new Date().getTime();
    log(`Done local duration: ${finishedAt - startedAt}ms`);
  } catch (error) {
    const msg = "Error processing event on " + lambdaName;
    log(`${msg}: ${errorToString(error)}`);
    capture.setExtra({
      event,
      context: lambdaName,
      error,
    });
    throw new MetriportError(msg, error);
  }
});

function parseBody(body?: unknown): WriteToS3Request {
  if (!body) throw new MetriportError(`Missing message body`);

  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new MetriportError(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  return parseWriteToS3(bodyAsJson);
}
