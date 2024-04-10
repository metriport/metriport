import https from "https";
import axios from "axios";
import { errorToString } from "../../../util/error/shared";
import { BulkSignedXCPD } from "../../saml/xcpd/iti55-envelope";
import { verifySaml } from "../../saml/security/verify";
import { capture } from "../../../util/notifications";

export async function sendSignedXml({
  signedXml,
  url,
  certChain,
  publicCert,
  key,
  passphrase,
}: {
  signedXml: string;
  url: string;
  certChain: string;
  publicCert: string;
  key: string;
  passphrase: string;
}): Promise<string> {
  const agent = new https.Agent({
    rejectUnauthorized: false,
    cert: certChain,
    key: key,
    passphrase,
  });

  const verified = verifySaml({ xmlString: signedXml, publicCert });
  if (!verified) {
    throw new Error("Signature verification failed.");
  } else {
    console.log("Signature verification passed.");
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
}): Promise<(string | { error: string })[]> {
  const requestPromises = signedRequests.map((request, index) =>
    sendSignedXml({
      signedXml: request.signedRequest,
      url: request.gateway.url,
      certChain,
      publicCert: publicCert,
      key: privateKey,
      passphrase: privateKeyPassword,
    })
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
        capture.error(msg, {
          extra: {
            context: `lambda.girth-outbound-patient-discovery`,
            error: errorString,
            patientId,
            cxId,
          },
        });
        console.log(error?.response?.data);
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
