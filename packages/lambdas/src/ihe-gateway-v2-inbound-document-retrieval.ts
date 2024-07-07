import {
  InboundDocumentRetrievalReq,
  InboundDocumentRetrievalResp,
} from "@metriport/ihe-gateway-sdk";
import * as Sentry from "@sentry/serverless";
import { getSecretValue } from "@metriport/core/external/aws/secret-manager";
import { getEnvVar, getEnvVarOrFail } from "@metriport/core/util/env-var";
import { processInboundDocumentRetrieval } from "@metriport/core/external/carequality/dr/process-inbound-dr";
import { processInboundDrRequest } from "@metriport/core/external/carequality/ihe-gateway-v2/inbound/xca/process-dr";
import { createIti39SoapEnvelopeInboundResponse } from "@metriport/core/external/carequality/ihe-gateway-v2/inbound/xca/create-dr-resp";
import { analyticsAsync, EventTypes } from "@metriport/core/external/analytics/posthog";

const postHogSecretName = getEnvVar("POST_HOG_API_KEY_SECRET");
const engineeringCxId = getEnvVar("ENGINEERING_CX_ID");
const region = getEnvVarOrFail("AWS_REGION");

export const handler = Sentry.AWSLambda.wrapHandler(async (event: string) => {
  const drRequest: InboundDocumentRetrievalReq = processInboundDrRequest(event);
  const result: InboundDocumentRetrievalResp = await processInboundDocumentRetrieval(drRequest);
  const xmlResponse = createIti39SoapEnvelopeInboundResponse(result);

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
});

const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  headers: { "Content-Type": "application/soap+xml" },
  body: body,
});
