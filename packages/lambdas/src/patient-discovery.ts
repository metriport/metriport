import { processIncomingRequest } from "@metriport/core/external/carequality/pd/process-incoming-pd";
import { MPIMetriportAPI } from "@metriport/core/mpi/patient-mpi-metriport-api";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import {
  baseRequestSchema,
  BaseRequest,
  PatientDiscoveryRequestIncoming,
} from "@metriport/ihe-gateway-sdk";
import * as Sentry from "@sentry/serverless";
import { APIGatewayProxyEvent } from "aws-lambda";

const apiUrl = getEnvVarOrFail("API_URL");
const mpi = new MPIMetriportAPI(apiUrl);

export const handler = Sentry.AWSLambda.wrapHandler(async (event: APIGatewayProxyEvent) => {
  if (!event.body) {
    return buildResponse(400, "Request body is missing");
  }

  let payload: PatientDiscoveryRequestIncoming;
  try {
    payload = JSON.parse(event.body);
  } catch (err) {
    return buildResponse(400, "Invalid JSON format");
  }

  let baseRequest: BaseRequest;
  try {
    baseRequest = baseRequestSchema.parse({
      id: payload.id,
      timestamp: payload.timestamp,
      samlAttributes: payload.samlAttributes,
      patientId: payload.patientId,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    return buildResponse(400, err.message);
  }
  const fullRequest: PatientDiscoveryRequestIncoming = {
    ...baseRequest,
    patientResource: payload.patientResource,
  };

  const result = await processIncomingRequest(fullRequest, mpi);
  return buildResponse(200, result);
});

const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
