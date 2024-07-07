import { InboundDocumentQueryReq, InboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";
import * as Sentry from "@sentry/serverless";
import { getSecretValue } from "@metriport/core/external/aws/secret-manager";
import { processInboundDq } from "@metriport/core/external/carequality/dq/process-inbound-dq";
import { processInboundDqRequest } from "@metriport/core/external/carequality/ihe-gateway-v2/inbound/xca/process/dq-request";
import { createInboundDqResponse } from "@metriport/core/external/carequality/ihe-gateway-v2/inbound/xca/create/dq-response";
import { analyticsAsync, EventTypes } from "@metriport/core/external/analytics/posthog";
import { getEnvVarOrFail, getEnvVar } from "@metriport/core/util/env-var";

const apiUrl = getEnvVarOrFail("API_URL");
const region = getEnvVarOrFail("AWS_REGION");
const engineeringCxId = getEnvVar("ENGINEERING_CX_ID");
const postHogSecretName = getEnvVar("POST_HOG_API_KEY_SECRET");

export const handler = Sentry.AWSLambda.wrapHandler(async (event: string) => {
  try {
    const dqRequest: InboundDocumentQueryReq = processInboundDqRequest(event);
    const result: InboundDocumentQueryResp = await processInboundDq(dqRequest, apiUrl);
    const xmlResponse = createInboundDqResponse(result);

    if (result.extrinsicObjectXmls && result.extrinsicObjectXmls.length > 1 && postHogSecretName) {
      const postHogApiKey = await getSecretValue(postHogSecretName, region);

      if (postHogApiKey && engineeringCxId) {
        await analyticsAsync(
          {
            distinctId: engineeringCxId,
            event: EventTypes.inboundDocumentQuery,
            properties: {
              patientId: result.patientId,
              documentCount: result.extrinsicObjectXmls.length,
              homeCommunityId: dqRequest.samlAttributes.homeCommunityId,
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
