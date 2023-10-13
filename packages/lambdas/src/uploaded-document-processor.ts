import * as Sentry from "@sentry/serverless";
import status from "http-status";
import { capture } from "./shared/capture";

// Keep this as early on the file as possible
capture.init();

const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  body,
});

export const handler = Sentry.AWSLambda.wrapHandler(async event => {
  console.log("Triggered the upload document process lambda! Type of event: ", typeof event);
  console.log("Event is:", JSON.stringify(event));

  return buildResponse(status.NOT_FOUND);
});
