import axios from "axios";
import * as Sentry from "@sentry/serverless";
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { outboundPatientDiscoveryReqSchema } from "@metriport/ihe-gateway-sdk";
import { PDRequestGatewayV2Params } from "@metriport/core/external/carequality/ihe-gateway-v2/ihe-gateway-v2";
import { createSignSendProcessXCPDRequest } from "@metriport/core/external/carequality/ihe-gateway-v2/ihe-gateway-v2-logic";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { Config } from "@metriport/core/util/config";
import { capture } from "./shared/capture";

const apiUrl = getEnvVarOrFail("API_URL");
const patientDiscoveryUrl = `http://${apiUrl}/internal/carequality/patient-discovery/response`;

// get secrets
const privateKeySecretName = Config.getCQOrgPrivateKey();
const privateKeyPasswordSecretName = Config.getCQOrgPrivateKeyPassword();
const publicCertSecretName = Config.getCQOrgCertificate();
const certChainSecretName = Config.getCQOrgCertificateIntermediate();

export const handler = Sentry.AWSLambda.wrapHandler(async (event: PDRequestGatewayV2Params) => {
  try {
    const { patientId, cxId, pdRequestGatewayV2 } = event;

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

    const results = await createSignSendProcessXCPDRequest({
      xcpdRequest: xcpdRequest.data,
      publicCert,
      privateKey,
      privateKeyPassword,
      certChain,
      patientId,
      cxId,
    });

    // send results to internal endpoint
    for (const result of results) {
      await axios.post(patientDiscoveryUrl, result);
    }
  } catch (error) {
    const msg = `An error occurred in the iheGatewayV2-outbound-patient-discovery lambda`;
    capture.error(msg, {
      extra: {
        context: `lambda.iheGatewayV2-outbound-patient-discovery`,
        error,
        event,
      },
    });
  }
});
