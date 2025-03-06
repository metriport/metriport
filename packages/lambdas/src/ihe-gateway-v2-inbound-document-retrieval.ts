import { EventTypes, analytics, initPostHog } from "@metriport/core/external/analytics/posthog";
import { getSecretValueOrFail } from "@metriport/core/external/aws/secret-manager";
import { processInboundDr } from "@metriport/core/external/carequality/dr/process-inbound-dr";
import { createInboundDrResponse } from "@metriport/core/external/carequality/ihe-gateway-v2/inbound/xca/create/dr-response";
import { processInboundDrRequest } from "@metriport/core/external/carequality/ihe-gateway-v2/inbound/xca/process/dr-request";
import {
  MtomAttachments,
  convertSoapResponseToMtomResponse,
  getBoundaryFromMtomResponse,
  parseMtomResponse,
} from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xca/mtom/parser";
import { getEnvVar, getEnvVarOrFail } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import {
  InboundDocumentRetrievalReq,
  InboundDocumentRetrievalResp,
} from "@metriport/ihe-gateway-sdk";
import { errorToString } from "@metriport/shared";
import { APIGatewayProxyEventV2 } from "aws-lambda";
import { getEnvOrFail } from "./shared/env";

const postHogSecretName = getEnvVarOrFail("POST_HOG_API_KEY_SECRET");
const engineeringCxId = getEnvVar("ENGINEERING_CX_ID");
const region = getEnvVarOrFail("AWS_REGION");
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
const { log } = out(`ihe-gateway-v2-inbound-document-retrieval`);

export async function handler(event: APIGatewayProxyEventV2) {
  const postHogApiKey = await getSecretValueOrFail(postHogSecretName, region);
  const postHog = initPostHog(postHogApiKey, "lambda");
  try {
    if (!event.body) return buildResponse(400, { message: "The request body is empty" });
    try {
      const boundary = getBoundaryFromMtomResponse(event.headers?.["content-type"]);
      let mtomParts: MtomAttachments;
      const bodyBuffer = event.isBase64Encoded
        ? Buffer.from(event.body, "base64")
        : Buffer.from(event.body);
      if (boundary) {
        mtomParts = await parseMtomResponse(bodyBuffer, boundary);
      } else {
        mtomParts = convertSoapResponseToMtomResponse(bodyBuffer);
      }
      const soapData = mtomParts.parts[0]?.body || Buffer.from("");

      const drRequest: InboundDocumentRetrievalReq = await processInboundDrRequest(
        soapData.toString()
      );
      const result: InboundDocumentRetrievalResp = await processInboundDr(drRequest);
      const xmlResponse = await createInboundDrResponse(result);

      if (result.documentReference && result.documentReference.length > 1 && postHogSecretName) {
        if (engineeringCxId) {
          analytics({
            distinctId: engineeringCxId,
            event: EventTypes.inboundDocumentRetrieval,
            properties: {
              patientId: result.patientId,
              documentCount: result.documentReference.length,
              homeCommunityId: drRequest.samlAttributes.homeCommunityId,
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
    await postHog.shutdown();
  }
}

const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  headers: { "Content-Type": "application/soap+xml" },
  body: body,
});
