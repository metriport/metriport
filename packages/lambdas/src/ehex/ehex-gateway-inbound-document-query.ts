import { processInboundDqRequest } from "@metriport/core/external/ehex/ehex-gateway/inbound/xca/process/dq-request";
import { out } from "@metriport/core/util/log";
import { base64ToString, errorToString, isClientError } from "@metriport/shared";
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { capture } from "../shared/capture";
import { getEnvOrFail } from "../shared/env";

const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");

export const handler = capture.wrapHandler(
  async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    const { log } = out(`ehex-gateway-inbound-DQ`);
    try {
      if (!event.body) return buildResponse(400, { message: "The request body is empty" });
      try {
        const body = event.isBase64Encoded ? base64ToString(event.body) : event.body;
        const invocationId = context.awsRequestId;
        const { statusCode, payload } = await processInboundDqRequest({
          appInstanceId: invocationId,
          body,
          headers: event.headers,
        });

        return buildResponse(statusCode, payload);
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

function buildResponse(status: number, body: string | object): APIGatewayProxyResult {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/soap+xml; charset=utf-8" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
}
