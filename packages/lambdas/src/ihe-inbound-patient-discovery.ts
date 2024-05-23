// import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { processInboundPatientDiscovery } from "@metriport/core/external/carequality/pd/process-inbound-pd";
import { MPIMetriportAPI } from "@metriport/core/mpi/patient-mpi-metriport-api";
import { getEnvVarOrFail, getEnvVar } from "@metriport/core/util/env-var";
import { getSecretValue } from "@metriport/core/external/aws/secret-manager";
import { inboundPatientDiscoveryReqSchema } from "@metriport/ihe-gateway-sdk";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import * as Sentry from "@sentry/serverless";

const apiUrl = getEnvVarOrFail("API_URL");
const region = getEnvVarOrFail("AWS_REGION");

const postHogSecretName = getEnvVar("POST_HOG_API_KEY_SECRET_NAME");
const mpi = new MPIMetriportAPI(apiUrl);

export const handler = Sentry.AWSLambda.wrapHandler(async (event: string) => {
  console.log(`Running with ${event}`);
  if (!event) return buildResponse(400, { message: "The request is invalid" });

  const baseRequest = inboundPatientDiscoveryReqSchema.safeParse(JSON.parse(event));
  if (!baseRequest.success) return buildResponse(400, baseRequest.error);

  const result = await processInboundPatientDiscovery(baseRequest.data, mpi);

  if (result.patientMatch && result.cxId && postHogSecretName) {
    const postHogApiKey = await getSecretValue(postHogSecretName, region);

    if (postHogApiKey) {
      analytics(
        {
          distinctId: result.cxId,
          event: EventTypes.inboundPatientDiscovery,
          properties: {
            patientId: result.patientId,
            patientMatch: result.patientMatch,
          },
        },
        postHogApiKey
      );
    }
  }

  return buildResponse(200, result);
});

function buildResponse(status: number, body: unknown) {
  console.log(`Returning (${status}): ${JSON.stringify(body)}`);
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json" },
    body,
  };
}
