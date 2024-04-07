// This is a helper script that lets you send xcpd requests in bulk
import fs from "fs";

import { createAndSignBulkXCPDRequests } from "@metriport/core/external/saml/xcpd/iti55-envelope";
import { sendSignedRequests } from "./saml-client";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";

import * as dotenv from "dotenv";
dotenv.config();

const privateKey = getEnvVarOrFail("IHE_PRODUCTION_KEY");
const publicCert = getEnvVarOrFail("IHE_PRODUCTION_CERT");
const certChain = getEnvVarOrFail("IHE_PRODUCTION_CERT_CHAIN");

const bulkRequestPath = "/Users/jonahkaye/Desktop/MetriportUnicorn/metriport/scratch/bad_xcpd.json";
const bulkData = JSON.parse(fs.readFileSync(bulkRequestPath, "utf8"));

async function bulkXcpdRequests() {
  const startTime = Date.now();
  const signedRequests = createAndSignBulkXCPDRequests(bulkData, publicCert, privateKey);
  fs.writeFileSync("../../scratch/outbound_xcpd.xml", signedRequests[0].signedRequest);
  const endTime = Date.now();
  console.log(`Time taken to sign ${signedRequests.length} requests: ${endTime - startTime} ms`);
  await sendSignedRequests(signedRequests, certChain, privateKey);
}

async function main() {
  try {
    await bulkXcpdRequests();
  } catch (error) {
    console.error("Failed to process bulk XCPD requests:", error);
  }
}

main();
