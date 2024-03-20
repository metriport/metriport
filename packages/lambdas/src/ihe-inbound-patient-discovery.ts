import * as Sentry from "@sentry/serverless";
import { processInboundPatientDiscovery } from "@metriport/core/external/carequality/pd/process-inbound-pd";
import { MPIMetriportAPI } from "@metriport/core/mpi/patient-mpi-metriport-api";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { inboundPatientDiscoveryReqSchema } from "@metriport/ihe-gateway-sdk";
import { capture } from "./shared/capture";
capture.init();

const apiUrl = getEnvVarOrFail("API_URL");
const mpi = new MPIMetriportAPI(apiUrl);

export const handler = Sentry.AWSLambda.wrapHandler(async (event: string) => {
  console.log(`Running with ${event}`);
  if (!event) return buildResponse(400, { message: "The request is invalid" });

  const baseRequest = inboundPatientDiscoveryReqSchema.safeParse(JSON.parse(event));
  if (!baseRequest.success) return buildResponse(400, baseRequest.error);

  const result = await processInboundPatientDiscovery(baseRequest.data, mpi);

  return buildResponse(200, result);
});

function buildResponse(status: number, body: unknown) {
  console.log(`Returning (${status}): ${JSON.stringify(body)}`);
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json" },
    body,
  };
}
