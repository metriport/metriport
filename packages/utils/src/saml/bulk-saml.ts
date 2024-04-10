// This is a helper script that lets you send xcpd requests in bulk
import fs from "fs";

import { createAndSignBulkXCPDRequests } from "@metriport/core/external/saml/xcpd/iti55-envelope";
import { sendSignedRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/saml-client";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";

import * as dotenv from "dotenv";
dotenv.config();

const privateKey = getEnvVarOrFail("IHE_STAGING_KEY");
const publicCert = getEnvVarOrFail("IHE_STAGING_CERT");
const certChain = getEnvVarOrFail("IHE_STAGING_CERT_CHAIN");
const privateKeyPassword = getEnvVarOrFail("IHE_STAGING_KEY_PASSWORD");

// path to a file containing an XCPD request json with many gateways
const bulkRequestPath = "";
const bulkData = JSON.parse(fs.readFileSync(bulkRequestPath, "utf8"));

async function bulkXcpdRequests() {
  const signedRequests = createAndSignBulkXCPDRequests(
    bulkData,
    publicCert,
    privateKey,
    privateKeyPassword
  );
  fs.writeFileSync("../../scratch/outbound_xcpd.xml", signedRequests[0].signedRequest);
  await sendSignedRequests({
    signedRequests,
    certChain,
    publicCert,
    privateKey,
    privateKeyPassword,
    patientId: "patientId",
    cxId: "cxId",
  });
}

async function main() {
  try {
    await bulkXcpdRequests();
  } catch (error) {
    console.error("Failed to process bulk XCPD requests:", error);
  }
}

main();
