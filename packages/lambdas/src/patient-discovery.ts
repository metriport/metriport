import { processIncomingRequest } from "@metriport/core/external/carequality/pd/process-incoming-pd";
import { MPIMetriportAPI } from "@metriport/core/mpi/patient-mpi-metriport-api";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { baseRequestSchema, PatientDiscoveryRequestIncoming } from "@metriport/ihe-gateway-sdk";
import * as Sentry from "@sentry/serverless";

// comment for diff...
const apiUrl = getEnvVarOrFail("API_URL");
const mpi = new MPIMetriportAPI(apiUrl);

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

    return await processIncomingRequest(fullRequest, mpi);
  }
);
