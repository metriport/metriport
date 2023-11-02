import * as Sentry from "@sentry/serverless";
import { capture } from "./shared/capture";

// Keep this as early on the file as possible
capture.init();

const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  body,
});

const defaultResponse = () => buildResponse(200);

//eslint-disable-next-line @typescript-eslint/no-explicit-any
type Request = { body?: any; headers: Record<string, string> };

export const handler = Sentry.AWSLambda.wrapHandler(async (req: Request) => {
  // just log the payload for now
  console.log(JSON.stringify(req));

  return defaultResponse();
});
