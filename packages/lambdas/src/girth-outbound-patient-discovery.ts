import axios from "axios";
import fs from "fs";
import https from "https";
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
import * as Sentry from "@sentry/serverless";
import { capture } from "./shared/capture";

const apiUrl = getEnvVarOrFail("API_URL");
const patientDiscoveryUrl = `${apiUrl}/internal/carequality/patient-discovery/response`;

// get secrets
const privateKey = "";
const publicCert = "";
const certChain = "";

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
    patientId,
    cxId
  );
  const results: OutboundPatientDiscoveryResp[] = responses.map((response, index) => {
    return processXCPDResponse({
      xmlString: response,
      outboundRequest: xcpdRequest.data,
      gateway: xcpdRequest.data.gateways[index],
    });
  });

  // send results to internal endpoint
  await axios.post(patientDiscoveryUrl, results);
});

export async function sendSignedXml(
  signedXml: string,
  url: string,
  certFilePath: string,
  keyFilePath: string
): Promise<string> {
  const agent = new https.Agent({
    rejectUnauthorized: false,
    cert: fs.readFileSync(certFilePath),
    key: fs.readFileSync(keyFilePath),
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
  patientId: string,
  cxId: string
): Promise<string[]> {
  const certFilePath = "./tempCert.pem";
  const keyFilePath = "./tempKey.pem";
  fs.writeFileSync(certFilePath, certChain);
  fs.writeFileSync(keyFilePath, privateKey);

  const requestPromises = signedRequests.map((request, index) =>
    sendSignedXml(request.signedRequest, request.gateway.url, certFilePath, keyFilePath)
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
