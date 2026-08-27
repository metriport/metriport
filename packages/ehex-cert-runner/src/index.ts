import * as dotenv from "dotenv";
dotenv.config();
// ^ Keep this at the top of the file
import { XCAGateway, XCPDGateway } from "@metriport/ihe-gateway-sdk";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { uuidv4 } from "@metriport/shared/util";
import { Command } from "commander";
import { makeEhexGateway } from "../../api/src/external/ehex-gateway/ehex-gateway-factory";
import {
  generateDocumentQueryRequest,
  generateDocumentRetrievalRequest,
  generatePatientDiscoveryRequest,
} from "./payloads";

const xcpdGatewayId = getEnvVarOrFail("XCPD_GATEWAY_ID");
const xcpdGatewayOid = getEnvVarOrFail("XCPD_GATEWAY_OID");
const xcpdGatewayUrl = getEnvVarOrFail("XCPD_GATEWAY_URL");

const xcaGatewayOid = getEnvVarOrFail("XCA_GATEWAY_OID");
const xcaGatewayHomeCommunityId = getEnvVarOrFail("XCA_GATEWAY_HOME_COMMUNITY_ID");
const dqGatewayUrl = getEnvVarOrFail("DQ_GATEWAY_URL");
const drGatewayUrl = getEnvVarOrFail("DR_GATEWAY_URL");
const itpPatientId = getEnvVarOrFail("EXTERNAL_GATEWAY_PATIENT_ID");

const cxId = getEnvVarOrFail("CX_ID");
const patientId = getEnvVarOrFail("PATIENT_ID");

const orgName = getEnvVarOrFail("ORG_NAME");
const orgOid = getEnvVarOrFail("ORG_OID");
const metriportHomeCommunityId = getEnvVarOrFail("HOME_COMMUNITY_ID");

const repositoryUniqueId = getEnvVarOrFail("REPOSITORY_UNIQUE_ID");
const externalDocumentId = getEnvVarOrFail("EXTERNAL_DOCUMENT_ID");

export const program = new Command();
program
  .name("ehex-cert-runner")
  .description("Tool to run through eHex certification test cases.")
  .option("--pd", "Run Patient Discovery (PD) test case", false)
  .option("--dq", "Run Document Query (DQ) test case", false)
  .option("--dr", "Run Document Retrieve (DR) test case", false)
  .option("--all", "Run all test cases (PD, DQ, DR) - this is the default", false)
  .addHelpText("before", metriportBanner())
  .showHelpAfterError();

async function main() {
  console.log(metriportBanner());
  const ehexGateway = makeEhexGateway();

  const options = program.opts();
  const hasPd = Boolean(options["pd"]);
  const hasDq = Boolean(options["dq"]);
  const hasDr = Boolean(options["dr"]);
  const hasAll = Boolean(options["all"]);
  const hasAnyOption = hasPd || hasDq || hasDr || hasAll;

  const shouldRunPd = hasPd || hasAll || !hasAnyOption;
  const shouldRunDq = hasDq || hasAll || !hasAnyOption;
  const shouldRunDr = hasDr || hasAll || !hasAnyOption;

  if (shouldRunPd) await runPatientDiscovery(ehexGateway);
  if (shouldRunDq) await runDocumentQuery(ehexGateway);
  if (shouldRunDr) await runDocumentRetrieval(ehexGateway);
}

async function runPatientDiscovery(ehexGateway: ReturnType<typeof makeEhexGateway>): Promise<void> {
  const pdRequest = generatePatientDiscoveryRequest({
    xcpdGateways: [buildXcpdGateway(xcpdGatewayUrl)],
    orgOid,
    orgName,
    patientId,
    cxId,
  });

  console.log("PD Request: \n", JSON.stringify(pdRequest, null, 2));
  await ehexGateway.startPatientDiscovery({
    pdRequest,
    patientId,
    cxId: pdRequest.cxId,
  });
  console.log("PD DONE!");
}

async function runDocumentQuery(ehexGateway: ReturnType<typeof makeEhexGateway>): Promise<void> {
  const dqRequest = generateDocumentQueryRequest({
    patientId,
    externalPatientId: itpPatientId,
    homeCommunityId: metriportHomeCommunityId,
    xcaGateway: buildXcaGateway(dqGatewayUrl),
    orgOid,
    orgName,
  });

  console.log("DQ Request: \n", JSON.stringify(dqRequest, null, 2));
  await ehexGateway.startDocumentQueryGateway({
    dqRequests: [dqRequest],
    requestId: uuidv4(),
    patientId,
    cxId,
  });
  console.log("DQ DONE!");
}

async function runDocumentRetrieval(
  ehexGateway: ReturnType<typeof makeEhexGateway>
): Promise<void> {
  const drRequest = generateDocumentRetrievalRequest({
    patientId,
    externalPatientId: itpPatientId,
    xcaGateway: buildXcaGateway(drGatewayUrl),
    orgOid,
    homeCommunityId: metriportHomeCommunityId,
    orgName,
    externalDocumentId,
    repositoryUniqueId,
  });

  console.log("DR Request: \n", JSON.stringify(drRequest, null, 2));
  await ehexGateway.startDocumentRetrievalGateway({
    drRequests: [drRequest],
    patientId,
    cxId,
  });
  console.log("DR DONE!");
}

function metriportBanner(): string {
  return `
            ,▄,
          ▄▓███▌
      ▄▀╙   ▀▓▀    ²▄
    ▄└               ╙▌
  ,▀                   ╨▄
  ▌                     ║
                         ▌
                         ▌
,▓██▄                 ╔███▄
╙███▌                 ▀███▀
    ▀▄
      ▀╗▄         ,▄
         '╙▀▀▀▀▀╙''

        Metriport Inc.

   eHealth Exchange Cert Runner
      `;
}

function buildXcpdGateway(url: string): XCPDGateway {
  return {
    id: xcpdGatewayId,
    oid: xcpdGatewayOid,
    url: url,
  };
}

function buildXcaGateway(url: string): XCAGateway {
  return {
    homeCommunityId: xcaGatewayOid,
    actualHomeCommunityId: xcaGatewayHomeCommunityId,
    url,
  };
}

program.parse();
main();
