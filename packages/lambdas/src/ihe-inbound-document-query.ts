import { inboundDocumentQueryReqSchema } from "@metriport/ihe-gateway-sdk";
import * as Sentry from "@sentry/serverless";
import { getSecretValue } from "@metriport/core/external/aws/secret-manager";
import { processInboundDocumentQuery } from "@metriport/core/external/carequality/dq/process-inbound-dq";
import { analyticsAsync, EventTypes } from "@metriport/core/external/analytics/posthog";
import { getEnvVarOrFail, getEnvVar } from "@metriport/core/util/env-var";

const apiUrl = getEnvVarOrFail("API_URL");
const region = getEnvVarOrFail("AWS_REGION");
const engineeringCxId = getEnvVar("ENGINEERING_CX_ID");
const postHogSecretName = getEnvVar("POST_HOG_API_KEY_SECRET");

export const handler = Sentry.AWSLambda.wrapHandler(async (event: string) => {
  console.log(`Running with ${event}`);
  if (!event) return buildResponse(400, { message: "The request is invalid" });

  const baseRequest = inboundDocumentQueryReqSchema.safeParse(JSON.parse(event));
  if (!baseRequest.success) return buildResponse(400, baseRequest.error);

  const result = await processInboundDocumentQuery(baseRequest.data, apiUrl);

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
            homeCommunityId: baseRequest.data.samlAttributes.homeCommunityId,
          },
        },
        {
          flushAt: 1,
          flushInterval: 0,
        },
        postHogApiKey
      );
    }
  }

  return buildResponse(200, result);
});

const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json" },
  body: body,
});
