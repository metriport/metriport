import axios from "axios";
import * as Sentry from "@sentry/serverless";
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import {
  outboundPatientDiscoveryReqSchema,
  OutboundPatientDiscoveryResp,
} from "@metriport/ihe-gateway-sdk";
import { createAndSignBulkXCPDRequests } from "@metriport/core/external/saml/xcpd/iti55-envelope";
import { processXCPDResponse } from "@metriport/core/external/carequality/ihe-gateway-v2/process-xcpd-response";
import { GirthXCPDRequestParams } from "@metriport/core/external/carequality/ihe-gateway-v2/invoke-patient-discovery";
import { sendSignedRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/saml-client";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { Config } from "@metriport/core/util/config";
import { capture } from "./shared/capture";

const apiUrl = getEnvVarOrFail("API_URL");
const patientDiscoveryUrl = `${apiUrl}/internal/carequality/patient-discovery/response`;

// get secrets
const privateKeySecretName = Config.getCQOrgPrivateKey();
const privateKeyPasswordSecretName = Config.getCQOrgPrivateKeyPassword();
const publicCertSecretName = Config.getCQOrgCertificate();
const certChainSecretName = Config.getCQOrgCertificateIntermediate();

export const handler = Sentry.AWSLambda.wrapHandler(async (event: GirthXCPDRequestParams) => {
  console.log("event", event);
  const { patientId, cxId, pdRequestGirth } = event;

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
  const xcpdRequest = outboundPatientDiscoveryReqSchema.safeParse(pdRequestGirth);
  if (!xcpdRequest.success) {
    const msg = `Invalid request: ${xcpdRequest.error}`;
    capture.error(msg, {
      extra: {
        context: `lambda.girth-outbound-patient-discovery`,
        error: xcpdRequest.error,
        patientId,
        cxId,
      },
    });
    throw Error;
  }
  const signedRequests = createAndSignBulkXCPDRequests(
    xcpdRequest.data,
    publicCert,
    privateKey,
    privateKeyPassword
  );
  const responses = await sendSignedRequests({
    signedRequests,
    certChain,
    publicCert,
    privateKey,
    privateKeyPassword,
    patientId,
    cxId,
  });
  const results: OutboundPatientDiscoveryResp[] = responses.map((response, index) => {
    const gateway = xcpdRequest.data.gateways[index];
    if (!gateway) {
      throw new Error(`Gateway at index ${index} is undefined.`);
    }
    return processXCPDResponse({
      xmlStringOrError: response,
      outboundRequest: xcpdRequest.data,
      gateway,
    });
  });

  // send results to internal endpoint
  for (const result of results) {
    await axios.post(patientDiscoveryUrl, result);
  }
});
