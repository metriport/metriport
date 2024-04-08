import axios from "axios";
import fs from "fs";
import https from "https";
import * as Sentry from "@sentry/serverless";
import { errorToString } from "@metriport/core/util/error/shared";
import {
  outboundPatientDiscoveryReqSchema,
  OutboundPatientDiscoveryResp,
} from "@metriport/ihe-gateway-sdk";
import {
  createAndSignBulkXCPDRequests,
  BulkSignedXCPD,
} from "@metriport/core/external/saml/xcpd/iti55-envelope";
import { processXCPDResponse } from "@metriport/core/external/carequality/ihe-gateway-v2/process-xcpd-response";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { Config } from "@metriport/core/util/config";
import { capture } from "./shared/capture";

const apiUrl = getEnvVarOrFail("API_URL");
const patientDiscoveryUrl = `${apiUrl}/internal/carequality/patient-discovery/response`;

// get secrets
const privateKey = Config.getCQOrgPrivateKey();
const privateKeyPassword = Config.getCQOrgPrivateKeyPassword();
const publicCert = Config.getCQOrgCertificate();
const certChain = Config.getCQOrgCertificateIntermediate();

export const handler = Sentry.AWSLambda.wrapHandler(async (event: string) => {
  const { patientId, cxId, req } = JSON.parse(event);

  // validate request
  const xcpdRequest = outboundPatientDiscoveryReqSchema.safeParse(req);
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
  const signedRequests = createAndSignBulkXCPDRequests(xcpdRequest.data, publicCert, privateKey);
  const responses = await sendSignedRequests(
    signedRequests,
    certChain,
    privateKey,
    privateKeyPassword,
    patientId,
    cxId
  );
  const results: OutboundPatientDiscoveryResp[] = responses.map((response, index) => {
    const gateway = xcpdRequest.data.gateways[index];
    if (!gateway) {
      throw new Error(`Gateway at index ${index} is undefined.`);
    }
    return processXCPDResponse({
      xmlString: response,
      outboundRequest: xcpdRequest.data,
      gateway,
    });
  });

  // send results to internal endpoint
  await axios.post(patientDiscoveryUrl, results);
});

export async function sendSignedXml(
  signedXml: string,
  url: string,
  certFilePath: string,
  keyFilePath: string,
  passphrase: string
): Promise<string> {
  const agent = new https.Agent({
    rejectUnauthorized: false,
    cert: fs.readFileSync(certFilePath),
    key: fs.readFileSync(keyFilePath),
    passphrase,
  });

  const response = await axios.post(url, signedXml, {
    headers: {
      "Content-Type": "application/soap+xml;charset=UTF-8",
      "Cache-Control": "no-cache",
    },
    httpsAgent: agent,
  });

  return response.data;
}

export async function sendSignedRequests(
  signedRequests: BulkSignedXCPD[],
  certChain: string,
  privateKey: string,
  privateKeyPassword: string,
  patientId: string,
  cxId: string
): Promise<string[]> {
  const certFilePath = "./tempCert.pem";
  const keyFilePath = "./tempKey.pem";
  fs.writeFileSync(certFilePath, certChain);
  fs.writeFileSync(keyFilePath, privateKey);

  const requestPromises = signedRequests.map((request, index) =>
    sendSignedXml(
      request.signedRequest,
      request.gateway.url,
      certFilePath,
      keyFilePath,
      privateKeyPassword
    )
      .then(response => {
        console.log(
          `Request ${index + 1} sent successfully to: ${request.gateway.url} + oid: ${
            request.gateway.oid
          }`
        );
        return response;
      })
      .catch(error => {
        const msg = `Request ${index + 1} ERRORs for gateway: ${request.gateway.url} + oid: ${
          request.gateway.oid
        }`;
        console.log(`${msg}: ${errorToString(error)}`);
        capture.error(msg, {
          extra: { context: `lambda.girth-outbound-patient-discovery`, error, patientId, cxId },
        });
      })
  );

  const responses = await Promise.allSettled(requestPromises);
  const successfulResponses = responses
    .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled")
    .map(result => result.value);

  fs.unlinkSync(certFilePath);
  fs.unlinkSync(keyFilePath);
  return successfulResponses;
}
