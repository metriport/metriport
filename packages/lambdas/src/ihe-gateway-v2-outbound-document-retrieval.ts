import * as Sentry from "@sentry/serverless";
import { outboundDocumentRetrievalReqSchema } from "@metriport/ihe-gateway-sdk";
import { DRRequestGatewayV2Params } from "@metriport/core/external/carequality/ihe-gateway-v2/ihe-gateway-v2";
import { createSignSendProcessDRRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/ihe-gateway-v2-logic";
import { getEnvVarOrFail, getEnvType } from "@metriport/core/util/env-var";
import { getSamlCertsAndKeys } from "./shared/secrets";
import { capture } from "./shared/capture";

const apiUrl = getEnvVarOrFail("API_URL");
const drResponseUrl = `http://${apiUrl}/internal/carequality/document-retrieval/response`;

export const handler = Sentry.AWSLambda.wrapHandler(
  async ({ patientId, cxId, requestId, drRequestsGatewayV2 }: DRRequestGatewayV2Params) => {
    try {
      console.log(
        `Running with envType: ${getEnvType()}, requestId: ${requestId}, ` +
          `numOfGateways: ${drRequestsGatewayV2.length} cxId: ${cxId} patientId: ${patientId}`
      );

      for (const request of drRequestsGatewayV2) {
        const drRequest = outboundDocumentRetrievalReqSchema.safeParse(request);
        if (!drRequest.success) {
          const msg = `Invalid request: ${drRequest.error}`;
          capture.error(msg, {
            extra: {
              context: `lambda.ihe-gateway-v2-outbound-document-retrieval`,
              error: drRequest.error,
              patientId,
              cxId,
            },
          });
          throw new Error(msg);
        }
      }
      const samlCertsAndKeys = await getSamlCertsAndKeys();

      await createSignSendProcessDRRequests({
        drResponseUrl,
        drRequestsGatewayV2,
        samlCertsAndKeys,
        patientId,
        cxId,
      });
    } catch (error) {
      const msg = `An error occurred in the iheGatewayV2-outbound-document-retrieval lambda`;
      capture.error(msg, {
        extra: {
          context: `lambda.iheGatewayV2-outbound-document-retrieval`,
          error,
          drRequestsGatewayV2,
          requestId,
          patientId,
          cxId,
        },
      });
    }
  }
);
