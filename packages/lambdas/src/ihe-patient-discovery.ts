import { processInboundPatientDiscovery } from "@metriport/core/external/carequality/pd/process-inbound-pd";
import { MPIMetriportAPI } from "@metriport/core/mpi/patient-mpi-metriport-api";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { inboundPatientDiscoveryReqSchema } from "@metriport/ihe-gateway-sdk";
import * as Sentry from "@sentry/serverless";
import { APIGatewayProxyEvent } from "aws-lambda";

const apiUrl = getEnvVarOrFail("API_URL");
const mpi = new MPIMetriportAPI(apiUrl);

export const handler = Sentry.AWSLambda.wrapHandler(async (event: APIGatewayProxyEvent) => {
  if (!event.body) {
    return buildResponse(400, { message: "The Request body is missing" });
  }
  const payload = JSON.parse(event.body);
  const baseRequest = inboundPatientDiscoveryReqSchema.parse({
    id: payload.id,
    timestamp: payload.timestamp,
    samlAttributes: payload.samlAttributes,
    patientResource: payload.patientResource,
  });
  const result = await processInboundPatientDiscovery(baseRequest, mpi);
  return buildResponse(200, result);
});
const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
