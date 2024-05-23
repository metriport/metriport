import { inboundDocumentRetrievalReqSchema } from "@metriport/ihe-gateway-sdk";
import * as Sentry from "@sentry/serverless";
import { getSecretValue } from "@metriport/core/external/aws/secret-manager";
import { getEnvVar, getEnvVarOrFail } from "@metriport/core/util/env-var";
import { processInboundDocumentRetrieval } from "@metriport/core/external/carequality/dr/process-inbound-dr";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";

const postHogSecretName = getEnvVar("POST_HOG_API_KEY_SECRET_NAME");
const region = getEnvVarOrFail("AWS_REGION");

export const handler = Sentry.AWSLambda.wrapHandler(async (event: string) => {
  console.log(`Running with: ${event}`);
  if (!event) return buildResponse(400, { message: "The request is invalid" });

  const baseRequest = inboundDocumentRetrievalReqSchema.safeParse(JSON.parse(event));
  if (!baseRequest.success) return buildResponse(400, baseRequest.error);
  const result = await processInboundDocumentRetrieval(baseRequest.data);

  if (
    result.documentReference &&
    result.documentReference.length > 0 &&
    result.cxId &&
    postHogSecretName
  ) {
    const postHogApiKey = await getSecretValue(postHogSecretName, region);

    if (postHogApiKey) {
      analytics(
        {
          distinctId: result.cxId,
          event: EventTypes.inboundDocumentRetrieval,
          properties: {
            patientId: result.patientId,
            documentCount: result.documentReference.length,
          },
        },
        postHogApiKey
      );
    }
  }

  console.log(`Response: ${result}`);
  return buildResponse(200, result);
});

const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json" },
  body: body,
});
