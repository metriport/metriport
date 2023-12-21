import * as Sentry from "@sentry/serverless";
import { capture } from "./shared/capture";
import { APIGatewayProxyEvent } from "aws-lambda";
import { generateITI38 } from "@metriport/core/external/carequality/iti-38-parsing";
import { generateITI39 } from "@metriport/core/external/carequality/iti-39-parsing";
import { generateXCPD } from "@metriport/core/external/carequality/iti-55-parsing";

capture.init();

export const handler = Sentry.AWSLambda.wrapHandler(async (event: APIGatewayProxyEvent) => {
  console.log(JSON.stringify(event));
  const path = event.path;
  let result;

  if (!event.body) {
    return buildResponse(400, "Request body is missing");
  }
  try {
    switch (path) {
      case "/xcpd/v1":
        result = await generateXCPD(event.body);
        break;
      case "/iti38/v1":
        result = await generateITI38(event.body);
        break;
      case "/iti39/v1":
        result = await generateITI39(event.body);
        break;
      default:
        throw new Error("Invalid path");
    }
    console.log("result", result);
    return buildResponse(200, result);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    return buildResponse(400, err.message);
  }
});

const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  headers: { "Content-Type": "application/soap+xml; charset=utf-8" },
  body: body,
});
