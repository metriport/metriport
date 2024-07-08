import { ALBEvent } from "aws-lambda";
import {
  InboundPatientDiscoveryReq,
  InboundPatientDiscoveryResp,
} from "@metriport/ihe-gateway-sdk";
import { errorToString } from "@metriport/shared";
import { processInboundXcpdRequest } from "@metriport/core/external/carequality/ihe-gateway-v2/inbound/xcpd/process/xcpd-request";
import { processInboundXcpd } from "@metriport/core/external/carequality/pd/process-inbound-pd";
import { createInboundXcpdResponse } from "@metriport/core/external/carequality/ihe-gateway-v2/inbound/xcpd/create/xcpd-response";
import { MPIMetriportAPI } from "@metriport/core/mpi/patient-mpi-metriport-api";
import { getEnvVarOrFail, getEnvVar } from "@metriport/core/util/env-var";
import { getSecretValue } from "@metriport/core/external/aws/secret-manager";
import { analyticsAsync, EventTypes } from "@metriport/core/external/analytics/posthog";
import { getEnvOrFail } from "./shared/env";

const apiUrl = getEnvVarOrFail("API_URL");
const region = getEnvVarOrFail("AWS_REGION");

const engineeringCxId = getEnvVar("ENGINEERING_CX_ID");
const postHogSecretName = getEnvVar("POST_HOG_API_KEY_SECRET");
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
const mpi = new MPIMetriportAPI(apiUrl);

export async function handler(event: ALBEvent) {
  try {
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
  } catch (error) {
    const msg = "Error processing event on " + lambdaName;
    console.log(`${msg}: ${errorToString(error)}`);
    return buildResponse(500, "Internal Server Error");
  }
}

function buildResponse(status: number, body: unknown) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/soap+xml" },
    body,
  };
}
