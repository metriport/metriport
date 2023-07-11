import * as Sentry from "@sentry/serverless";
import { capture } from "./shared/capture";
import * as lambda from "aws-lambda";

// Keep this as early on the file as possible
capture.init();

export const handler = Sentry.AWSLambda.wrapHandler(
  async (event: lambda.APIGatewayRequestAuthorizerEvent) => {
    console.log(event);
    const response = {
      statusCode: 301,
      headers: {
        Location: "https://S3_URL",
      },
    };

    return response;
  }
);
