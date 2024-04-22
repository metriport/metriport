import * as dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import { createAndSignBulkXCPDRequests } from "@metriport/core/external/saml/xcpd/iti55-envelope";
import { sendSignedRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/saml-client";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";

/*This is a helper script that lets you sign and send xcpd requests in bulk to as many gateways as you want.
 *Its purpose is to allow you test specific gateways responses with granularity when debugging or testing.
 */

const privateKey = getEnvVarOrFail("IHE_PRODUCTION_KEY");
const publicCert = getEnvVarOrFail("IHE_PRODUCTION_CERT");
const certChain = getEnvVarOrFail("IHE_PRODUCTION_CERT_CHAIN");
const privateKeyPassword = getEnvVarOrFail("IHE_PRODUCTION_KEY_PASSWORD");

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
  fs.writeFileSync("./runs/saml/outbound_xcpd.xml", signedRequests[0].signedRequest);
  const responses = await sendSignedRequests({
    signedRequests,
    certChain,
    publicCert,
    privateKey,
    privateKeyPassword,
    patientId: "patientId",
    cxId: "cxId",
  });
  fs.writeFileSync("./runs/saml/inbound_xcpd.xml", responses[0].response);
}

async function main() {
  try {
    await bulkXcpdRequests();
  } catch (error) {
    console.error("Failed to process bulk XCPD requests:", error);
  }
}

main();
