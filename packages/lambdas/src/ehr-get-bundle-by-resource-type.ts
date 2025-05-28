import { GetBundleByResourceTypeRequest } from "@metriport/core/external/ehr/command/get-bundle-by-resource-type/ehr-get-bundle-by-resource-type";
import { EhrGetBundleByResourceTypeDirect } from "@metriport/core/external/ehr/command/get-bundle-by-resource-type/ehr-get-bundle-by-resource-type-direct";
import { MetriportError } from "@metriport/shared";
import * as Sentry from "@sentry/serverless";
import { SQSEvent } from "aws-lambda";
import { capture } from "./shared/capture";
import { ehrGetBundleByResourceTypeSchema } from "./shared/ehr";
import { getEnvOrFail } from "./shared/env";
import { prefixedLog } from "./shared/log";
import { getSingleMessageOrFail } from "./shared/sqs";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");

// TODO move to capture.wrapHandler()
export const handler = Sentry.AWSLambda.wrapHandler(async (event: SQSEvent) => {
  capture.setExtra({ event, context: lambdaName });

  const startedAt = new Date().getTime();
  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;

  console.log(`Running with unparsed body: ${message.body}`);
  const parsedBody = parseBody(message.body);
  const { ehr, cxId, practiceId } = parsedBody;

  const log = prefixedLog(`ehr ${ehr}, cxId ${cxId}, practiceId ${practiceId}`);
  log(`Parsed: ${JSON.stringify(parsedBody)}`);

  const ehrGetBundleByResourceTypeHandler = new EhrGetBundleByResourceTypeDirect();
  const bundle = await ehrGetBundleByResourceTypeHandler.getBundleByResourceType(parsedBody);

  const finishedAt = new Date().getTime();
  log(`Done local duration: ${finishedAt - startedAt}ms`);
  return bundle;
});

function parseBody(body?: unknown): GetBundleByResourceTypeRequest {
  if (!body) throw new MetriportError(`Missing message body`);

  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new MetriportError(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  return ehrGetBundleByResourceTypeSchema.parse(bodyAsJson);
}
