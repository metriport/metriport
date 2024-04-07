import axios from "axios";
import fs from "fs";
import https from "https";
import { BulkXCPDResponse } from "@metriport/core/external/saml/xcpd/iti55-envelope";

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
  signedRequests: BulkXCPDResponse[],
  certChain: string,
  privateKey: string
) {
  const certFilePath = "./tempCert.pem";
  const keyFilePath = "./tempKey.pem";
  fs.writeFileSync(certFilePath, certChain);
  fs.writeFileSync(keyFilePath, privateKey);

  let errorCount = 0;
  const errorMessages: string[] = [];

  const requestPromises = signedRequests.map((request, index) =>
    sendSignedXml(request.signedRequest, request.gateway.url, certFilePath, keyFilePath)
      .then(response => {
        console.log(
          `Request ${index + 1} sent successfully to: ${request.gateway.url} + oid: ${
            request.gateway.oid
          }`
        );
        return { success: true, index, response };
      })
      .catch(error => {
        console.error(
          `Request ${index + 1} ERRORs for gateway: ${request.gateway.url} + oid: ${
            request.gateway.oid
          }`
        );
        console.error(error);
        errorCount++;
        errorMessages.push(`Request ${index + 1} error: ${error}`);
        return { success: false, index, error };
      })
  );

  await Promise.allSettled(requestPromises);

  // Log the summary of errors
  console.log(`Total requests sent: ${signedRequests.length}`);
  console.log(`Total errors encountered: ${errorCount}`);
  errorMessages.forEach(msg => console.log(msg));

  fs.unlinkSync(certFilePath);
  fs.unlinkSync(keyFilePath);
}
