import * as Sentry from "@sentry/serverless";
import { PatientDiscoveryRequestIncoming } from "@metriport/ihe-gateway-sdk";
import { processIncomingRequest } from "@metriport/core/external/carequality/xcpd/process-incoming-xcpd";
// Function to construct error response

export const handler = Sentry.AWSLambda.wrapHandler(
  async (payload: PatientDiscoveryRequestIncoming) => {
    return await processIncomingRequest(payload);
  }
);
