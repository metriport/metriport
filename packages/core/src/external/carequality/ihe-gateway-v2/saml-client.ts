import https from "https";
import axios from "axios";
import { errorToString } from "../../../util/error/shared";
import { BulkSignedXCPD } from "../../saml/xcpd/iti55-envelope";

export async function sendSignedXml(
  signedXml: string,
  url: string,
  cert: string,
  key: string,
  passphrase: string
): Promise<string> {
  const agent = new https.Agent({
    rejectUnauthorized: false,
    cert: cert,
    key: key,
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
): Promise<(string | { error: string })[]> {
  const requestPromises = signedRequests.map((request, index) =>
    sendSignedXml(
      request.signedRequest,
      request.gateway.url,
      certChain,
      privateKey,
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
        const errorString: string = errorToString(error);
        console.log(`${msg}: ${errorString}, patientId: ${patientId}, cxId: ${cxId}`);
        return { error: errorString };
      })
  );

  const responses = await Promise.allSettled(requestPromises);
  const processedResponses = responses
    .map(result => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        return undefined;
      }
    })
    .filter((response): response is string | { error: string } => response !== undefined);

  return processedResponses;
}
