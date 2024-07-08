import { ALBEvent } from "aws-lambda";
import {
  InboundPatientDiscoveryReq,
  InboundPatientDiscoveryResp,
} from "@metriport/ihe-gateway-sdk";
import { processInboundXcpdRequest } from "@metriport/core/external/carequality/ihe-gateway-v2/inbound/xcpd/process/xcpd-request";
import { processInboundXcpd } from "@metriport/core/external/carequality/pd/process-inbound-pd";
import { createInboundXcpdResponse } from "@metriport/core/external/carequality/ihe-gateway-v2/inbound/xcpd/create/xcpd-response";
import { MPIMetriportAPI } from "@metriport/core/mpi/patient-mpi-metriport-api";
import { getEnvVarOrFail, getEnvVar } from "@metriport/core/util/env-var";
import { getSecretValue } from "@metriport/core/external/aws/secret-manager";
import { analyticsAsync, EventTypes } from "@metriport/core/external/analytics/posthog";
import * as Sentry from "@sentry/serverless";

const apiUrl = getEnvVarOrFail("API_URL");
const region = getEnvVarOrFail("AWS_REGION");

const engineeringCxId = getEnvVar("ENGINEERING_CX_ID");
const postHogSecretName = getEnvVar("POST_HOG_API_KEY_SECRET");
const mpi = new MPIMetriportAPI(apiUrl);

export const handler = Sentry.AWSLambda.wrapHandler(async (event: ALBEvent) => {
  console.log(`Running with ${event}`);
  if (!event.body) return buildResponse(400, { message: "The request body is empty" });

  try {
    const pdRequest: InboundPatientDiscoveryReq = processInboundXcpdRequest(event.body);
    const result: InboundPatientDiscoveryResp = await processInboundXcpd(pdRequest, mpi);
    const xmlResponse = createInboundXcpdResponse({
      request: pdRequest,
      response: result,
    });

    if (result.patientMatch && postHogSecretName) {
      const postHogApiKey = await getSecretValue(postHogSecretName, region);

      if (postHogApiKey && engineeringCxId) {
        await analyticsAsync(
          {
            distinctId: engineeringCxId,
            event: EventTypes.inboundPatientDiscovery,
            properties: {
              patientId: result.patientId,
              patientMatch: result.patientMatch,
              homeCommunityId: pdRequest.samlAttributes.homeCommunityId,
            },
          },
          postHogApiKey
        );
      }
    }

    return buildResponse(200, xmlResponse);
  } catch (error) {
    console.log(JSON.stringify(error, null, 2));
    return buildResponse(400, error);
  }
});

function buildResponse(status: number, body: unknown) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/soap+xml" },
    body,
  };
}
