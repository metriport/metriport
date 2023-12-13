import * as Sentry from "@sentry/serverless";

export const handler = Sentry.AWSLambda.wrapHandler(async (payload): Promise<string> => {
  console.log("Payload: ", payload);
  return Promise.resolve("Hello from iti55 Lambda!");
});
