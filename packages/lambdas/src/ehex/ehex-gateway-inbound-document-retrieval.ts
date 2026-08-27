import { processInboundDrRequest } from "@metriport/core/external/ehex/ehex-gateway/inbound/xca/process/dr-request";
import { out } from "@metriport/core/util/log";
import { errorToString, isClientError } from "@metriport/shared";
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { capture } from "../shared/capture";
import { getEnvOrFail } from "../shared/env";

capture.init();

const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");

export const handler = capture.wrapHandler(
  async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    const { log } = out(`ehex-gateway-inbound-DR`);
    try {
      if (!event.body) {
        return buildResponse(400, JSON.stringify({ message: "The request body is empty" }));
      }
      try {
        const invocationId = context.awsRequestId;
        const { statusCode, payload, contentType } = await processInboundDrRequest({
          appInstanceId: invocationId,
          body: event.body,
          isBase64Encoded: event.isBase64Encoded,
          headers: event.headers,
        });

        return buildResponse(statusCode, { payload, contentType });
      } catch (error) {
        if (isClientError(error)) {
          log(`Client error on ${lambdaName}: ${errorToString(error)}`);
          return buildResponse(400, errorToString(error));
        }
        throw error;
      }
    } catch (error) {
      const msg = "Server error processing event on " + lambdaName;
      log(`${msg}: ${errorToString(error)}`);
      return buildResponse(500, "Internal Server Error");
    }
  }
);

function buildResponse(
  status: number,
  body: string | { payload: Buffer; contentType: string }
): APIGatewayProxyResult {
  if (typeof body === "string") {
    return {
      statusCode: status,
      headers: { "Content-Type": "application/soap+xml; charset=utf-8" },
      body,
    };
  }
  const { payload, contentType } = body;
  return {
    statusCode: status,
    // TODO ENG-1601 Validate this works on the cloud
    headers: { "Content-Type": contentType },
    body: payload.toString(),
  };
}
