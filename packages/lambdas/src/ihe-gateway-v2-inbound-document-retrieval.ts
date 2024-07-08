import { ALBEvent } from "aws-lambda";
import {
  InboundDocumentRetrievalReq,
  InboundDocumentRetrievalResp,
} from "@metriport/ihe-gateway-sdk";
import * as Sentry from "@sentry/serverless";
import { getSecretValue } from "@metriport/core/external/aws/secret-manager";
import { getEnvVar, getEnvVarOrFail } from "@metriport/core/util/env-var";
import { processInboundDr } from "@metriport/core/external/carequality/dr/process-inbound-dr";
import { processInboundDrRequest } from "@metriport/core/external/carequality/ihe-gateway-v2/inbound/xca/process/dr-request";
import { createInboundDrResponse } from "@metriport/core/external/carequality/ihe-gateway-v2/inbound/xca/create/dr-response";
import { analyticsAsync, EventTypes } from "@metriport/core/external/analytics/posthog";

const postHogSecretName = getEnvVar("POST_HOG_API_KEY_SECRET");
const engineeringCxId = getEnvVar("ENGINEERING_CX_ID");
const region = getEnvVarOrFail("AWS_REGION");

export const handler = Sentry.AWSLambda.wrapHandler(async (event: ALBEvent) => {
  console.log(`Running with ${event}`);
  if (!event.body) return buildResponse(400, { message: "The request body is empty" });
  try {
    const drRequest: InboundDocumentRetrievalReq = processInboundDrRequest(event.body);
    const result: InboundDocumentRetrievalResp = await processInboundDr(drRequest);
    const xmlResponse = createInboundDrResponse(result);

    if (result.documentReference && result.documentReference.length > 1 && postHogSecretName) {
      const postHogApiKey = await getSecretValue(postHogSecretName, region);

      if (postHogApiKey && engineeringCxId) {
        await analyticsAsync(
          {
            distinctId: engineeringCxId,
            event: EventTypes.inboundDocumentRetrieval,
            properties: {
              patientId: result.patientId,
              documentCount: result.documentReference.length,
              homeCommunityId: drRequest.samlAttributes.homeCommunityId,
            },
          },
          postHogApiKey
        );
      }
    }

    return buildResponse(200, xmlResponse);
  } catch (error) {
    return buildResponse(400, error);
  }
});

const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  headers: { "Content-Type": "application/soap+xml" },
  body: body,
});
