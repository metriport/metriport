import * as Sentry from "@sentry/serverless";
import { PatientDiscoveryRequestIncoming } from "@metriport/ihe-gateway-sdk";
import { processIncomingRequest } from "@metriport/core/external/carequality/iti55/process-incoming-iti-55";
// Function to construct error response

export const handler = Sentry.AWSLambda.wrapHandler(
  async (payload: PatientDiscoveryRequestIncoming) => {
    return await processIncomingRequest(payload);
  }
);
