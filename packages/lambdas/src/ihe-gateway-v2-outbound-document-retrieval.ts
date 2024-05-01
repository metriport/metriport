import * as Sentry from "@sentry/serverless";
import { DRRequestGatewayV2Params } from "@metriport/core/external/carequality/ihe-gateway-v2/ihe-gateway-v2";
import { createSignSendProcessDRRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/ihe-gateway-v2-logic";
import { getEnvVarOrFail, getEnvType } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import { getSamlCertsAndKeys } from "./shared/secrets";
import { capture } from "./shared/capture";
capture.init();

const { log } = out("ihe-gateway-v2-outbound-document-retrieval");
const apiUrl = getEnvVarOrFail("API_URL");
const drResponseUrl = `http://${apiUrl}/internal/carequality/document-retrieval/response`;

export const handler = Sentry.AWSLambda.wrapHandler(
  async ({ patientId, cxId, requestId, drRequestsGatewayV2 }: DRRequestGatewayV2Params) => {
    log(
      `Running with envType: ${getEnvType()}, requestId: ${requestId}, ` +
        `numOfGateways: ${drRequestsGatewayV2.length} cxId: ${cxId} patientId: ${patientId}`
    );

    const samlCertsAndKeys = await getSamlCertsAndKeys();

    await createSignSendProcessDRRequests({
      drResponseUrl,
      drRequestsGatewayV2,
      samlCertsAndKeys,
      patientId,
      cxId,
    });
  }
);
