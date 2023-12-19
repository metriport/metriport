import * as Sentry from "@sentry/serverless";
import {
  PatientDiscoveryRequestIncoming,
  PatientDiscoveryResponseOutgoing,
} from "@metriport/ihe-gateway-sdk";
import { processRequest as processIncomingRequest } from "@metriport/core/external/carequality/process-incoming-iti-55";
// Function to construct error response
function constructErrorResponse(
  payload: PatientDiscoveryRequestIncoming
): PatientDiscoveryResponseOutgoing {
  return {
    id: payload.id,
    timestamp: payload.timestamp,
    responseTimestamp: new Date().toISOString(),
    patientMatch: false,
    xcpdHomeCommunityId: payload.samlAttributes.homeCommunityId,
    operationOutcome: {
      resourceType: "OperationOutcome",
      id: payload.id,
      issue: [
        {
          severity: "error",
          code: "structure",
          details: { text: "Invalid structure" },
        },
      ],
    },
  };
}

export const handler = Sentry.AWSLambda.wrapHandler(
  async (payload: PatientDiscoveryRequestIncoming) => {
    try {
      return await processIncomingRequest(payload);
    } catch (error) {
      Sentry.captureException(error);
      return constructErrorResponse(payload);
    }
  }
);
