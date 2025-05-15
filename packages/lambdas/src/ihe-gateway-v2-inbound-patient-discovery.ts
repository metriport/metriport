import { APIGatewayProxyEventV2 } from "aws-lambda";
import {
  InboundPatientDiscoveryReq,
  InboundPatientDiscoveryResp,
} from "@metriport/ihe-gateway-sdk";
import { errorToString } from "@metriport/shared";
import { processInboundXcpdRequest } from "@metriport/core/external/carequality/ihe-gateway-v2/inbound/xcpd/process/xcpd-request";
import { processInboundXcpd } from "@metriport/core/external/carequality/pd/process-inbound-pd";
import { createInboundXcpdResponse } from "@metriport/core/external/carequality/ihe-gateway-v2/inbound/xcpd/create/xcpd-response";
import { InboundMpiMetriportApi } from "@metriport/core/mpi/inbound-patient-mpi-metriport-api";
import { getEnvVarOrFail, getEnvVar } from "@metriport/core/util/env-var";
import { getSecretValue } from "@metriport/core/external/aws/secret-manager";
import { analyticsAsync, EventTypes } from "@metriport/core/external/analytics/posthog";
import { out } from "@metriport/core/util/log";
import { getEnvOrFail } from "./shared/env";

const apiUrl = getEnvVarOrFail("API_URL");
const region = getEnvVarOrFail("AWS_REGION");

const engineeringCxId = getEnvVar("ENGINEERING_CX_ID");
const postHogSecretName = getEnvVar("POST_HOG_API_KEY_SECRET");
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
const mpi = new InboundMpiMetriportApi(apiUrl);
const { log } = out(`ihe-gateway-v2-inbound-patient-discovery`);

// TODO move to capture.wrapHandler()
export async function handler(event: APIGatewayProxyEventV2) {
  try {
    if (!event.body) return buildResponse(400, { message: "The request body is empty" });

    console.log("event", event);

    try {
      const body = event.isBase64Encoded
        ? Buffer.from(event.body, "base64").toString()
        : event.body;
      const pdRequest: InboundPatientDiscoveryReq = await processInboundXcpdRequest(body);
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
      log(`Client error on ${lambdaName}: ${errorToString(error)}`);
      return buildResponse(400, errorToString(error));
    }
  } catch (error) {
    const msg = "Server error processing event on " + lambdaName;
    log(`${msg}: ${errorToString(error)}`);
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
