// This is a helper script that lets you send xcpd requests in bulk
import fs from "fs";

import {
  createAndSignBulkXCPDRequests,
  BulkXCPDResponse,
} from "@metriport/core/external/saml/xcpd/iti55-envelope";
import { sendSignedXml } from "./saml-client";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";

import * as dotenv from "dotenv";
dotenv.config();

const privateKey = getEnvVarOrFail("IHE_PRODUCTION_KEY");
const publicCert = getEnvVarOrFail("IHE_PRODUCTION_CERT");
const certChain = getEnvVarOrFail("IHE_PRODUCTION_CERT_CHAIN");

const bulkRequestPath =
  "/Users/jonahkaye/Desktop/MetriportUnicorn/metriport/scratch/xcpd_request.json";
const bulkData = JSON.parse(fs.readFileSync(bulkRequestPath, "utf8"));

async function bulkXcpdRequests() {
  const startTime = Date.now();
  const signedRequests = await createAndSignBulkXCPDRequests(bulkData, certChain, privateKey);
  const endTime = Date.now();
  console.log(`Time taken to sign 1500 requests: ${endTime - startTime} ms`);
  await sendFirstTwoSignedRequests(signedRequests);
}

async function sendFirstTwoSignedRequests(signedRequests: BulkXCPDResponse[]) {
  if (signedRequests.length < 2) {
    console.error("Not enough signed requests to send the first two.");
    return;
  }

  try {
    console.log("Sending request for gateway: ", signedRequests[0].gateway);
    const firstResponse = await sendSignedXml(
      signedRequests[0].signedRequest,
      signedRequests[0].gateway.url,
      publicCert,
      privateKey
    );
    console.log("First request sent successfully:", firstResponse);

    console.log("Sending request for gateway: ", signedRequests[1].gateway);
    const secondResponse = await sendSignedXml(
      signedRequests[1].signedRequest,
      signedRequests[1].gateway.url,
      publicCert,
      privateKey
    );
    console.log("Second request sent successfully:", secondResponse);
  } catch (error) {
    //console.error("Error sending signed requests:", error);
  }
}

async function main() {
  try {
    await bulkXcpdRequests();
  } catch (error) {
    console.error("Failed to process bulk XCPD requests:", error);
  }
}

main();
