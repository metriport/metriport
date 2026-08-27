import { processInboundXcpdRequest } from "@metriport/core/external/ehex/ehex-gateway/inbound/xcpd/process/xcpd-request";
import { out } from "@metriport/core/util/log";
import { base64ToString, errorToString, isClientError } from "@metriport/shared";
import { APIGatewayProxyEventV2, APIGatewayProxyResult, Context } from "aws-lambda";
import { capture } from "../shared/capture";
import { getEnvOrFail } from "../shared/env";

capture.init();

const apiUrl = getEnvOrFail("API_URL");

export const handler = capture.wrapHandler(
  async (event: APIGatewayProxyEventV2, context: Context): Promise<APIGatewayProxyResult> => {
    const { log } = out(`ehex-gateway-inbound-patient-discovery`);

    try {
      if (!event.body) {
        return buildResponse(400, { message: "The request body is empty" });
      }
      const body = event.isBase64Encoded ? base64ToString(event.body) : event.body;
      const invocationId = context.awsRequestId;

      const { statusCode, payload } = await processInboundXcpdRequest({
        appInstanceId: invocationId,
        body,
        apiUrl,
        headers: event.headers,
      });

      return buildResponse(statusCode, payload);
    } catch (error) {
      if (isClientError(error)) {
        return buildResponse(400, errorToString(error));
      }
      const msg = "Server error processing event";
      log(`${msg}: ${errorToString(error)}`);
      return buildResponse(500, "Internal Server Error");
    }
  }
);

function buildResponse(status: number, body: string | object): APIGatewayProxyResult {
  const resp: APIGatewayProxyResult = {
    statusCode: status,
    headers: { "Content-Type": "application/soap+xml; charset=utf-8" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
  return resp;
}
