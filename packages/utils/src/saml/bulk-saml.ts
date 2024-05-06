// This is a helper script that lets you test constructing your own soap+saml requests. It creates the SOAP Envelope and then sends it to the gateway specified in the request body.
// npm run saml-server and then reference the Metriport- IHE GW / XML + SAML Constructor - Postman collection
import * as dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { XCPDGateway } from "@metriport/ihe-gateway-sdk";
import { createAndSignBulkXCPDRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xcpd/create/iti55-envelope";
import { sendSignedXCPDRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xcpd/send/xcpd-requests";
import { processXCPDResponse } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xcpd/process/xcpd-response";

const samlCertsAndKeys = {
  publicCert: getEnvVarOrFail("CQ_ORG_CERTIFICATE_PRODUCTION"),
  privateKey: getEnvVarOrFail("CQ_ORG_PRIVATE_KEY_PRODUCTION"),
  privateKeyPassword: getEnvVarOrFail("CQ_ORG_PRIVATE_KEY_PASSWORD_PRODUCTION"),
  certChain: getEnvVarOrFail("CQ_ORG_CERTIFICATE_INTERMEDIATE_PRODUCTION"),
};

const patientId = uuidv4();
const cxId = uuidv4();

const bulkPath = "/Users/jonahkaye/Desktop/MetriportUnicorn/metriport/scratch/girth.json";
async function main() {
  const body = JSON.parse(fs.readFileSync(bulkPath, "utf8"));

  body.gateways = body.gateways.filter(
    (gateway: XCPDGateway) =>
      !gateway.url.includes("https://rle.surescripts.net/IHE/PatientDiscovery") &&
      !gateway.url.includes("https://patientdiscovery.api.commonwellalliance.org")
  );
  // const epicGateways = [
  //   "https://careeverywhereprd.uhnj.org:14430/Interconnect-CE/wcf/epic.community.hie/xcpdrespondinggatewaysync.svc/ceq",
  //   "https://epicproxyce.mhsjvl.org:14430/Interconnect-CE/wcf/epic.community.hie/xcpdrespondinggatewaysync.svc/ceq",
  //   "https://epic-cerproxyprod.coh.org:14430/interconnect-prd-ce/wcf/epic.community.hie/xcpdrespondinggatewaysync.svc/ceq",
  //   "https://epprdce.scripps.org:14430/Interconnect-PRD-CE/wcf/epic.community.hie/xcpdrespondinggatewaysync.svc/ceq",
  //   "https://ce.aspirus.org:4437/Interconnect-CE/wcf/epic.community.hie/xcpdrespondinggatewaysync.svc/ceq",
  //   "https://careeverywhere.edward.org:14430/Interconnect-CEPRD/wcf/epic.community.hie/xcpdrespondinggatewaysync.svc/ceq",
  //   "https://ce.wacofhc.org:14430/Interconnect-CE/wcf/epic.community.hie/xcpdrespondinggatewaysync.svc/ceq",
  //   "https://careeverywhere.genesishcs.org:14430/Interconnect-CE-PRD/wcf/epic.community.hie/xcpdrespondinggatewaysync.svc/Ceq",
  //   "https://partnerconnection.uch.edu:14430/Interconnect-PRD2010-CE/wcf/epic.community.hie/xcpdrespondinggatewaysync.svc/ceq",
  //   "https://nyuce.nyumc.org:14430/Interconnect-CEPRD/wcf/epic.community.hie/xcpdrespondinggatewaysync.svc/ceq",
  //   "https://careeverywhere.nghs.com:14430/interconnect-ce-prd/wcf/epic.community.hie/xcpdrespondinggatewaysync.svc/ceq",
  //   "https://sfdmcf.mcfarlandclinic.com:14430/Interconnect-CE-PRD/wcf/epic.community.hie/xcpdrespondinggatewaysync.svc/ceq",
  //   "https://ceprod.chmca.org:14430/Interconnect-PRD/wcf/epic.community.hie/xcpdrespondinggatewaysync.svc/ceq",
  //   "https://HIE.HCMED.ORG:14430/Interconnect-CE/wcf/epic.community.hie/xcpdrespondinggatewaysync.svc/ceq",
  //   "https://careeverywhere.upstate.edu:14430/Interconnect-CE2012/wcf/epic.community.hie/xcpdrespondinggatewaysync.svc/ceq",
  //   "https://CareEverywherePRD.metrohealth.net:14430/interconnect-careeverywhere/wcf/epic.community.hie/xcpdrespondinggatewaysync.svc/ceq",
  //   "https://careeverywhere.atriushealth.org:14430/Interconnect-Prod/wcf/epic.community.hie/xcpdrespondinggatewaysync.svc/ceq",
  //   "https://sfd.et1126.epichosted.com:14430/Interconnect-CE-PRD/wcf/epic.community.hie/xcpdrespondinggatewaysync.svc/ceq",
  //   "https://careeverywhere.nortonhealthcare.org:14430/Interconnect-Care/wcf/epic.community.hie/xcpdrespondinggatewaysync.svc/ceq",
  //   "https://careeverywhere.ohiohealth.com:14430/Interconnect-prd/wcf/epic.community.hie/xcpdrespondinggatewaysync.svc/ceq",
  //   "https://careeverywhere.osumc.edu:14430/Interconnect-CareEverywhere/wcf/epic.community.hie/xcpdrespondinggatewaysync.svc/Ceq"
  // ]

  // body.gateways = body.gateways.filter((gateway: XCPDGateway) => gateway.url.includes("ehealthexchange"));
  body.timestamp = new Date().toISOString();

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
  fs.writeFileSync("../../scratch/bulk-responses-post-ehex.json", JSON.stringify(results, null, 2));
}

main();
