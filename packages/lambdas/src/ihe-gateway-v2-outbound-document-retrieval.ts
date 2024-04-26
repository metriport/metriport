import * as Sentry from "@sentry/serverless";
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { outboundDocumentRetrievalReqSchema } from "@metriport/ihe-gateway-sdk";
import { DRRequestGatewayV2Params } from "@metriport/core/external/carequality/ihe-gateway-v2/ihe-gateway-v2";
import { createSignSendProcessDRRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/ihe-gateway-v2-logic";
import { getEnvVarOrFail, getEnvType } from "@metriport/core/util/env-var";
import { Config } from "@metriport/core/util/config";
import { capture } from "./shared/capture";

const apiUrl = getEnvVarOrFail("API_URL");
const drResponseUrl = `http://${apiUrl}/internal/carequality/document-retrieval/response`;

const privateKeySecretName = Config.getCQOrgPrivateKey();
const privateKeyPasswordSecretName = Config.getCQOrgPrivateKeyPassword();
const publicCertSecretName = Config.getCQOrgCertificate();
const certChainSecretName = Config.getCQOrgCertificateIntermediate();

export const handler = Sentry.AWSLambda.wrapHandler(
  async ({ patientId, cxId, requestId, drRequestsGatewayV2 }: DRRequestGatewayV2Params) => {
    try {
      console.log(
        `Running with envType: ${getEnvType()}, requestId: ${requestId}, ` +
          `numOfGateways: ${drRequestsGatewayV2.length} cxId: ${cxId} patientId: ${patientId}`
      );

      const privateKey = await getSecret(privateKeySecretName);
      const privateKeyPassword = await getSecret(privateKeyPasswordSecretName);
      const publicCert = await getSecret(publicCertSecretName);
      const certChain = await getSecret(certChainSecretName);
      if (
        !privateKey ||
        typeof privateKey !== "string" ||
        !privateKeyPassword ||
        typeof privateKeyPassword !== "string" ||
        !publicCert ||
        typeof publicCert !== "string" ||
        !certChain ||
        typeof certChain !== "string"
      ) {
        throw new Error("Failed to get secrets or one of the secrets is not a string.");
      }

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

      await createSignSendProcessDRRequests({
        drResponseUrl,
        drRequestsGatewayV2,
        publicCert,
        privateKey,
        privateKeyPassword,
        certChain,
        patientId,
        cxId,
      });
    } catch (error) {
      const msg = `An error occurred in the iheGatewayV2-outbound-document-retrieval lambda`;
      capture.error(msg, {
        extra: {
          context: `lambda.iheGatewayV2-outbound-document-retrieval`,
          error,
          event,
        },
      });
    }
  }
);
