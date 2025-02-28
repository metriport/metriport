import {
  EventTypes,
  analytics,
  initPostHog,
  shutdownPostHog,
} from "@metriport/core/external/analytics/posthog";
import { getSecretValueOrFail } from "@metriport/core/external/aws/secret-manager";
import { processInboundDq } from "@metriport/core/external/carequality/dq/process-inbound-dq";
import { createInboundDqResponse } from "@metriport/core/external/carequality/ihe-gateway-v2/inbound/xca/create/dq-response";
import { processInboundDqRequest } from "@metriport/core/external/carequality/ihe-gateway-v2/inbound/xca/process/dq-request";
import { getEnvVar, getEnvVarOrFail } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import { InboundDocumentQueryReq, InboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";
import { errorToString } from "@metriport/shared";
import { APIGatewayProxyEventV2 } from "aws-lambda";
import { getEnvOrFail } from "./shared/env";

const region = getEnvVarOrFail("AWS_REGION");
const engineeringCxId = getEnvVar("ENGINEERING_CX_ID");
const postHogSecretName = getEnvVarOrFail("POST_HOG_API_KEY_SECRET");
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
const { log } = out(`ihe-gateway-v2-inbound-document-query`);

export async function handler(event: APIGatewayProxyEventV2) {
  const postHogApiKey = await getSecretValueOrFail(postHogSecretName, region);
  initPostHog(postHogApiKey, "lambda");
  try {
    if (!event.body) return buildResponse(400, { message: "The request body is empty" });
    try {
      const body = event.isBase64Encoded
        ? Buffer.from(event.body, "base64").toString()
        : event.body;
      const dqRequest: InboundDocumentQueryReq = await processInboundDqRequest(body);
      const result: InboundDocumentQueryResp = await processInboundDq(dqRequest);
      const xmlResponse = createInboundDqResponse(result);

      if (
        result.extrinsicObjectXmls &&
        result.extrinsicObjectXmls.length > 1 &&
        postHogSecretName
      ) {
        if (engineeringCxId) {
          analytics({
            distinctId: engineeringCxId,
            event: EventTypes.inboundDocumentQuery,
            properties: {
              patientId: result.patientId,
              documentCount: result.extrinsicObjectXmls.length,
              homeCommunityId: dqRequest.samlAttributes.homeCommunityId,
            },
          });
        }
      }

      return buildResponse(200, xmlResponse);
    } catch (error) {
      log(`Client error on ${lambdaName}: ${errorToString(error)}`);
      return buildResponse(400, errorToString(error));
    }
  } catch (error) {
    const msg = "Server error processing event on " + lambdaName;
    log(`${msg}: ${errorToString(error)}`);
    return buildResponse(500, "Internal Server Error");
  } finally {
    await shutdownPostHog();
  }
}

const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  headers: { "Content-Type": "application/soap+xml" },
  body: body,
});
