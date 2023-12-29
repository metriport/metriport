import * as Sentry from "@sentry/serverless";
import { processIncomingRequest } from "@metriport/core/external/carequality/pd/process-incoming-xcpd";
import { PatientDiscoveryRequestIncoming, baseRequestSchema } from "@metriport/ihe-gateway-sdk";

export const handler = Sentry.AWSLambda.wrapHandler(
  async (payload: PatientDiscoveryRequestIncoming) => {
    const baseRequest = baseRequestSchema.parse({
      id: payload.id,
      timestamp: payload.timestamp,
      samlAttributes: payload.samlAttributes,
      patientId: payload.patientId,
    });

    const fullRequest: PatientDiscoveryRequestIncoming = {
      ...baseRequest,
      patientResource: payload.patientResource,
    };

    return await processIncomingRequest(fullRequest);
  }
);
