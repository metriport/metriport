import * as Sentry from "@sentry/serverless";
import { outboundPatientDiscoveryReqSchema } from "@metriport/ihe-gateway-sdk";
import { PDRequestGatewayV2Params } from "@metriport/core/external/carequality/ihe-gateway-v2/ihe-gateway-v2";
import { createSignSendProcessXCPDRequest } from "@metriport/core/external/carequality/ihe-gateway-v2/ihe-gateway-v2-logic";
import { getEnvVarOrFail, getEnvType } from "@metriport/core/util/env-var";
import { getSamlCertsAndKeys } from "./shared/secrets";
import { capture } from "./shared/capture";

const apiUrl = getEnvVarOrFail("API_URL");
const pdResponseUrl = `http://${apiUrl}/internal/carequality/patient-discovery/response`;

export const handler = Sentry.AWSLambda.wrapHandler(
  async ({ cxId, patientId, pdRequestGatewayV2 }: PDRequestGatewayV2Params) => {
    try {
      console.log(
        `Running with envType: ${getEnvType()}, requestId: ${pdRequestGatewayV2.id}, ` +
          `numOfGateways: ${pdRequestGatewayV2.gateways.length} cxId: ${cxId} patientId: ${patientId}`
      );

      // validate request
      const xcpdRequest = outboundPatientDiscoveryReqSchema.safeParse(pdRequestGatewayV2);
      if (!xcpdRequest.success) {
        const msg = `Invalid XCPD request - Does not conform to schema.`;
        capture.error(msg, {
          extra: {
            context: `lambda.iheGatewayV2-outbound-patient-discovery`,
            error: xcpdRequest.error,
            patientId,
            cxId,
          },
        });
        throw new Error(msg);
      }

      const samlCertsAndKeys = await getSamlCertsAndKeys();
      await createSignSendProcessXCPDRequest({
        pdResponseUrl,
        xcpdRequest: xcpdRequest.data,
        samlCertsAndKeys,
        patientId,
        cxId,
      });
    } catch (error) {
      const msg = `An error occurred in the iheGatewayV2-outbound-patient-discovery lambda`;
      capture.error(msg, {
        extra: {
          context: `lambda.ihe-gateway-v2-outbound-patient-discovery`,
          error,
          patientId,
          cxId,
          pdRequestGatewayV2,
        },
      });
    }
  }
);
