#!/usr/bin/env node
import { IHEGateway } from "@metriport/core/external/carequality/ihe-gateway-types";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import * as dotenv from "dotenv";
import { Command } from "commander";
import { generatePatient } from "./payloads";

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

   Carequality Cert Runner
      `;
}

export const program = new Command();
program
  .name("carequality-cert-runner")
  .description("Tool to run through CQ certification test cases.")
  .requiredOption(
    `--env-file <file-path>`,
    `Absolute path to the .env file containing required config. Example required file contents:
    // TODO: UPDATE THIS EXAMPLE
"
    `
  )
  .addHelpText("before", metriportBanner())
  .showHelpAfterError()
  .version("1.0.0");

async function main() {
  console.log(metriportBanner());
  program.parse();
  const options = program.opts();
  dotenv.config({ path: options["envFile"] });

  const iheGatewayUrl = getEnvVarOrFail("IHE_GATEWAY_URL");
  const xcpdGatewayId = getEnvVarOrFail("XCPD_GATEWAY_ID");
  const xcpdGatewayOid = getEnvVarOrFail("XCPD_GATEWAYS_OID");
  const xcpdGatewayUrl = getEnvVarOrFail("XCPD_GATEWAYS_URL");

  const orgName = getEnvVarOrFail("ORG_NAME");
  const orgOid = getEnvVarOrFail("ORG_OID");

  const iheGateway = new IHEGateway({ url: iheGatewayUrl });

  const patient = generatePatient(
    [
      {
        id: xcpdGatewayId,
        oid: xcpdGatewayOid,
        url: xcpdGatewayUrl,
      },
    ],
    orgOid,
    orgName
  );

  await iheGateway.startPatientDiscovery(patient);

  // TODO: INCLUDE DOCUMENT QUERY AND RETRIEVAL WHEN API ROUTES ARE READY
}

main();
