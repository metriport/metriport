import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import fs from "fs";
import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { XCPDGateway } from "@metriport/ihe-gateway-sdk";
import { createAndSignBulkXCPDRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xcpd/create/iti55-envelope";
import { sendSignedXCPDRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xcpd/send/xcpd-requests";
import { processXCPDResponse } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xcpd/process/xcpd-response";

/** This is a helper script to test constructing your own SOAP+SAML requests. It creates the SOAP 
Envelope and sends it to the gateway specified in the request body. It logs the output into the 
runs/saml-coverage folder for later analysis. It is recommended to use the saml-coverage script 
to analyze the results after running. Run `npm run saml-server` and then reference the 
Metriport-IHE GW / XML + SAML Constructor - Postman collection.
*/

const timestamp = dayjs().toISOString();

// Set these to staging if you want to actually test the endpoints in a pre-prod env
const samlCertsAndKeys = {
  publicCert: getEnvVarOrFail("CQ_ORG_CERTIFICATE_STAGING"),
  privateKey: getEnvVarOrFail("CQ_ORG_PRIVATE_KEY_STAGING"),
  privateKeyPassword: getEnvVarOrFail("CQ_ORG_PRIVATE_KEY_PASSWORD_STAGING"),
  certChain: getEnvVarOrFail("CQ_ORG_CERTIFICATE_INTERMEDIATE_STAGING"),
};

const patientId = uuidv4();
const cxId = uuidv4();

// path to xcpd request file
const bulkPath = "";
async function main() {
  const body = JSON.parse(fs.readFileSync(bulkPath, "utf8"));

  body.gateways = body.gateways.filter(
    (gateway: XCPDGateway) =>
      !gateway.url.includes("https://rle.surescripts.net/IHE/PatientDiscovery") &&
      !gateway.url.includes("https://patientdiscovery.api.commonwellalliance.org")
  );

  console.log("signing bulk requests...", body.gateways.length);
  const xmlResponses = createAndSignBulkXCPDRequests(body, samlCertsAndKeys);
  console.log("sending bulk requests...");
  const responses = await sendSignedXCPDRequests({
    signedRequests: xmlResponses,
    samlCertsAndKeys,
    patientId: uuidv4(),
    cxId: uuidv4(),
  });
  console.log("processing bulk responses...");
  const results = responses.map(response => {
    return processXCPDResponse({
      xcpdResponse: response,
      patientId,
      cxId,
    });
  });

  console.log("writing bulk responses to file...");
  fs.writeFileSync(
    `./runs/saml-coverage/bulk-xcpd-${timestamp}.json`,
    JSON.stringify(results, null, 2)
  );
}

main();
