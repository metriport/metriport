import { processIncomingRequest } from "@metriport/core/external/carequality/pd/process-incoming-pd";
import { MPIMetriportAPI } from "@metriport/core/mpi/patient-mpi-metriport-api";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { patientDiscoveryReqFromExternalGatewaySchema } from "@metriport/ihe-gateway-sdk";
import * as Sentry from "@sentry/serverless";
import { APIGatewayProxyEvent } from "aws-lambda";

const apiUrl = getEnvVarOrFail("API_URL");
const mpi = new MPIMetriportAPI(apiUrl);

export const handler = Sentry.AWSLambda.wrapHandler(async (event: APIGatewayProxyEvent) => {
  if (!event.body) {
    return buildResponse(400, { message: "Request body is missing" });
  }
  const payload = JSON.parse(event.body);
  const baseRequest = patientDiscoveryReqFromExternalGatewaySchema.parse({
    id: payload.id,
    timestamp: payload.timestamp,
    samlAttributes: payload.samlAttributes,
    patientResource: payload.patientResource,
  });
  const result = await processIncomingRequest(baseRequest, mpi);
  return buildResponse(200, result);
});

const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
