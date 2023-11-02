import * as Sentry from "@sentry/serverless";
import { capture } from "./shared/capture";
import { APIGatewayProxyEvent } from "aws-lambda";

// Keep this as early on the file as possible
capture.init();

const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  body,
});

const defaultResponse = () => buildResponse(200);

export const handler = Sentry.AWSLambda.wrapHandler(async (req: APIGatewayProxyEvent) => {
  // just log the payload for now
  console.log(JSON.stringify(req));

  return defaultResponse();
});
