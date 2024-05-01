import * as Sentry from "@sentry/serverless";
import { DQRequestGatewayV2Params } from "@metriport/core/external/carequality/ihe-gateway-v2/ihe-gateway-v2";
import { createSignSendProcessDQRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/ihe-gateway-v2-logic";
import { getEnvVarOrFail, getEnvType } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import { getSamlCertsAndKeys } from "./shared/secrets";
import { capture } from "./shared/capture";
capture.init();

const { log } = out("ihe-gateway-v2-outbound-document-query");
const apiUrl = getEnvVarOrFail("API_URL");
const documentQueryResponseUrl = `http://${apiUrl}/internal/carequality/document-query/response`;

export const handler = Sentry.AWSLambda.wrapHandler(
  async ({ patientId, cxId, requestId, dqRequestsGatewayV2 }: DQRequestGatewayV2Params) => {
    try {
      log(
        `Running with envType: ${getEnvType()}, requestId: ${requestId}, ` +
          `numOfGateways: ${dqRequestsGatewayV2.length} cxId: ${cxId} patientId: ${patientId}`
      );

      const samlCertsAndKeys = await getSamlCertsAndKeys();
      await createSignSendProcessDQRequests({
        dqResponseUrl: documentQueryResponseUrl,
        dqRequestsGatewayV2,
        samlCertsAndKeys,
        patientId,
        cxId,
      });
    } catch (error) {
      const msg = `An error occurred in the ihe-gateway-v2-outbound-document-query lambda`;
      capture.error(msg, {
        extra: {
          context: `lambda.ihe-gateway-v2-outbound-document-query`,
          error,
          requestId,
          patientId,
          cxId,
          dqRequestsGatewayV2,
        },
      });
    }
  }
);
