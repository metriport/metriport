import { inboundDocumentQueryReqSchema } from "@metriport/ihe-gateway-sdk";
import * as Sentry from "@sentry/serverless";
import { getSecretValue } from "@metriport/core/external/aws/secret-manager";
import { processInboundDocumentQuery } from "@metriport/core/external/carequality/dq/process-inbound-dq";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { getEnvVarOrFail, getEnvVar } from "@metriport/core/util/env-var";

const apiUrl = getEnvVarOrFail("API_URL");
const region = getEnvVarOrFail("AWS_REGION");
const postHogSecretName = getEnvVar("POST_HOG_API_KEY_SECRET_NAME");

export const handler = Sentry.AWSLambda.wrapHandler(async (event: string) => {
  console.log(`Running with ${event}`);
  if (!event) return buildResponse(400, { message: "The request is invalid" });

  const baseRequest = inboundDocumentQueryReqSchema.safeParse(JSON.parse(event));
  if (!baseRequest.success) return buildResponse(400, baseRequest.error);

  const result = await processInboundDocumentQuery(baseRequest.data, apiUrl);

  if (result.extrinsicObjectXmls && result.extrinsicObjectXmls.length > 0 && result.cxId) {
    let postHogApiKey: string | undefined;

    if (postHogSecretName) {
      postHogApiKey = await getSecretValue(postHogSecretName, region);
    }

    analytics(
      {
        distinctId: result.cxId,
        event: EventTypes.inboundDocumentQuery,
        properties: {
          patientId: result.patientId,
          documentCount: result.extrinsicObjectXmls.length,
        },
      },
      postHogApiKey
    );
  }

  return buildResponse(200, result);
});

const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json" },
  body: body,
});
