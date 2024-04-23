import https from "https";
import axios from "axios";
import { XCPDGateway } from "@metriport/ihe-gateway-sdk";
import { executeAsynchronously } from "../../../util/concurrency";
import { out } from "../../../util/log";
import { errorToString } from "../../../util/error/shared";
import { BulkSignedXCPD } from "../../saml/xcpd/iti55-envelope";
import { verifySaml } from "../../saml/security/verify";
import { capture } from "../../../util/notifications";

export type SamlClientResponse = {
  gateway: XCPDGateway;
  response: string;
  success: boolean;
};

const numberOfParallelExecutions = 10;

export async function sendSignedXml({
  signedXml,
  url,
  certChain,
  publicCert,
  key,
  passphrase,
  trustedRootCert,
}: {
  signedXml: string;
  url: string;
  certChain: string;
  publicCert: string;
  key: string;
  passphrase: string;
  trustedRootCert?: string[];
}): Promise<string> {
  const agent = new https.Agent({
    cert: certChain,
    key: key,
    passphrase,
    ca: trustedRootCert,
  });

  const verified = verifySaml({ xmlString: signedXml, publicCert });
  if (!verified) {
    throw new Error("Signature verification failed.");
  }
  const response = await axios.post(url, signedXml, {
    headers: {
      "Content-Type": "application/soap+xml;charset=UTF-8",
      "Cache-Control": "no-cache",
    },
    httpsAgent: agent,
  });

  return response.data;
}

export async function sendSignedRequests({
  signedRequests,
  certChain,
  publicCert,
  privateKey,
  privateKeyPassword,
  patientId,
  cxId,
}: {
  signedRequests: BulkSignedXCPD[];
  certChain: string;
  publicCert: string;
  privateKey: string;
  privateKeyPassword: string;
  patientId: string;
  cxId: string;
}): Promise<SamlClientResponse[]> {
  const { log } = out(`Send signed requests - patientId: ${patientId}`);

  const processedResponses: SamlClientResponse[] = [];

  await executeAsynchronously(
    signedRequests,
    async (request, index) => {
      try {
        const response = await sendSignedXml({
          signedXml: request.signedRequest,
          url: request.gateway.url,
          certChain,
          publicCert,
          key: privateKey,
          passphrase: privateKeyPassword,
        });
        log(
          `Request ${index + 1} sent successfully to: ${request.gateway.url} + oid: ${
            request.gateway.oid
          }`
        );
        processedResponses.push({
          gateway: request.gateway,
          response,
          success: true,
        });
      } catch (error) {
        const msg = "HTTP/SSL Failure Sending Signed SAML Request";
        const requestDetails = `Request ${index + 1} ERRORs for gateway: ${
          request.gateway.url
        } + oid: ${request.gateway.oid}`;
        const errorString: string = errorToString(error);
        const extra = {
          errorString,
          requestDetails,
          patientId,
          cxId,
        };
        capture.error(msg, {
          extra: {
            context: `lambda.iheGatewayV2-outbound-patient-discovery`,
            extra,
          },
        });
        processedResponses.push({
          gateway: request.gateway,
          response: errorString,
          success: false,
        });
      }
    },
    { numberOfParallelExecutions }
  );

  return processedResponses;
}
