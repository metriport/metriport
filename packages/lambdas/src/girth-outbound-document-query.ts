import axios from "axios";
import * as Sentry from "@sentry/serverless";
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import {
  OutboundDocumentQueryResp,
  outboundDocumentQueryReqSchema,
} from "@metriport/ihe-gateway-sdk";
import { createAndSignBulkDQRequests } from "@metriport/core/external/saml/xca/iti38-envelope";
import {
  processDQResponse,
  GirthDQRequestParams,
} from "@metriport/core/external/carequality/ihe-gateway-v2/dq/process-dq-response";
import { sendSignedRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/saml-client";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { Config } from "@metriport/core/util/config";
import { capture } from "./shared/capture";

const apiUrl = getEnvVarOrFail("API_URL");
const documentQueryResponseUrl = `${apiUrl}/internal/carequality/document-query/response`;

const privateKeySecretName = Config.getCQOrgPrivateKey();
const privateKeyPasswordSecretName = Config.getCQOrgPrivateKeyPassword();
const publicCertSecretName = Config.getCQOrgCertificate();
const certChainSecretName = Config.getCQOrgCertificateIntermediate();

export const handler = Sentry.AWSLambda.wrapHandler(async (event: GirthDQRequestParams) => {
  const { patientId, cxId, dqRequestsGirth } = event;

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

  const xcpdRequest = outboundDocumentQueryReqSchema.safeParse(dqRequestsGirth);
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

  const signedRequests = createAndSignBulkDQRequests({
    bulkBodyData: dqRequestsGirth,
    publicCert,
    privateKey,
    privateKeyPassword,
  });
  const responses = await sendSignedRequests({
    signedRequests,
    certChain,
    publicCert,
    privateKey,
    privateKeyPassword,
    patientId,
    cxId,
  });
  const results: OutboundDocumentQueryResp[] = responses.map(
    (response: string | { error: string }, index: number) => {
      const outboundRequest = dqRequestsGirth[index];
      if (!outboundRequest) {
        throw new Error(`Outbound request at index ${index} is undefined.`);
      }
      const gateway = outboundRequest.gateway;
      if (!gateway) {
        throw new Error(`Gateway at index ${index} is undefined.`);
      }
      return processDQResponse({
        xmlStringOrError: response,
        outboundRequest: outboundRequest,
        gateway,
      });
    }
  );

  for (const result of results) {
    await axios.post(documentQueryResponseUrl, result);
  }
});
