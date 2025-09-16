import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import fs from "fs";
import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { XCPDGateway } from "@metriport/ihe-gateway-sdk";
import { createAndSignBulkXCPDRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xcpd/create/iti55-envelope";
import { sendProcessXcpdRequest } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/ihe-gateway-v2-logic";
import { setRejectUnauthorized } from "@metriport/core/external/carequality/ihe-gateway-v2/saml/saml-client";
import { setS3UtilsInstance as setS3UtilsInstanceForStoringIheResponse } from "@metriport/core/external/carequality/ihe-gateway-v2/monitor/store";
import { MockS3Utils } from "./mock-s3";
import { Config } from "@metriport/core/util/config";

/** This is a helper script to test constructing your own SOAP+SAML requests. It creates the SOAP 
Envelope and sends it to the gateway specified in the request body. It logs the output into the 
runs/saml-coverage folder for later analysis. It is recommended to use the saml-coverage script 
to analyze the results after running. Run `npm run saml-server` and then reference the 
Metriport-IHE GW / XML + SAML Constructor - Postman collection.
*/

const timestamp = dayjs().toISOString();
const env = "STAGING";
setRejectUnauthorized(false);
const s3utils = new MockS3Utils(Config.getAWSRegion());
setS3UtilsInstanceForStoringIheResponse(s3utils);

// Set these to staging if you want to actually test the endpoints in a pre-prod env
const samlCertsAndKeys = {
  publicCert: getEnvVarOrFail(`CQ_ORG_CERTIFICATE_${env}`),
  privateKey: getEnvVarOrFail(`CQ_ORG_PRIVATE_KEY_${env}`),
  privateKeyPassword: getEnvVarOrFail(`CQ_ORG_PRIVATE_KEY_PASSWORD_${env}`),
  certChain: getEnvVarOrFail(`CQ_ORG_CERTIFICATE_INTERMEDIATE_${env}`),
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
  const signedRequests = createAndSignBulkXCPDRequests(body, samlCertsAndKeys);

  const resultPromises = signedRequests.map(async (signedRequest, index) => {
    return sendProcessXcpdRequest({
      signedRequest,
      samlCertsAndKeys,
      patientId,
      cxId,
      index,
    });
  });
  console.log("sending and processing bulk requests...");
  const results = await Promise.all(resultPromises);

  console.log("writing bulk responses to file...");
  fs.writeFileSync(
    `./runs/saml-coverage/bulk-xcpd-${timestamp}.json`,
    JSON.stringify(results, null, 2)
  );
}

main();
