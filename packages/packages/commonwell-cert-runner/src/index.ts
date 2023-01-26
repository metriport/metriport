#!/usr/bin/env node
import { APIMode, CommonWell, PurposeOfUse, RequestMetadata } from "@metriport/commonwell-sdk";
import { Command } from "commander";
import * as dotenv from "dotenv";
import { personManagement } from "./person-management";
import { patientManagement } from "./patient-management";
import { linkManagement } from "./link-management";
import { getEnvOrFail } from "./util";

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

    CommonWell Cert Runner
      `;
}

export const program = new Command();
program
  .name("cw-cert-runner")
  .description("Tool to run through Edge System CommonWell certification test cases.")
  .requiredOption(
    `--env-file <file-path>`,
    `Absolute path to the .env file containing required config. Example required file contents:

COMMONWELL_ORG_NAME=Metriport
COMMONWELL_OID=2.16.840.1.113883.3.9621
COMMONWELL_SANDBOX_ORG_NAME=Metriport-OrgA-1617
COMMONWELL_SANDBOX_OID=2.16.840.1.113883.3.3330.8889429.1617.1
COMMONWELL_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
fkadsjhfhdsakjfhdsakhfkdsahfadshfkhdsfhdsakfdhafkashdfkjhalsdkjf
-----END PRIVATE KEY-----
"
COMMONWELL_CERTIFICATE="-----BEGIN CERTIFICATE-----
asdlkfjladsjflkjdaslkfjdsafjadslfjasdlkfjdsaklfjdkalfjdslfjalkjs
-----END CERTIFICATE-----
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
  dotenv.config({ path: options.envFile });

  // Main Account Org
  const commonwellPrivateKey = getEnvOrFail("COMMONWELL_PRIVATE_KEY");
  const commonwellCert = getEnvOrFail("COMMONWELL_CERTIFICATE");
  const commonwellOID = getEnvOrFail("COMMONWELL_OID");
  const commonwellOrgName = getEnvOrFail("COMMONWELL_ORG_NAME");

  const commonWell = new CommonWell(
    commonwellCert,
    commonwellPrivateKey,
    commonwellOrgName,
    commonwellOID,
    APIMode.integration
  );

  // Sandbox Account Org
  const commonwellSandboxOID = getEnvOrFail("COMMONWELL_SANDBOX_OID");
  const commonwellSandboxOrgName = getEnvOrFail("COMMONWELL_SANDBOX_ORG_NAME");

  const commonWellSandbox = new CommonWell(
    commonwellCert,
    commonwellPrivateKey,
    commonwellSandboxOrgName,
    commonwellSandboxOID,
    APIMode.integration
  );

  const queryMeta: RequestMetadata = {
    purposeOfUse: PurposeOfUse.TREATMENT,
    role: "ict",
    subjectId: "admin",
  };

  // Run through the CommonWell certification test cases

  await personManagement(commonWell, queryMeta);
  await patientManagement(commonWell, commonWellSandbox, queryMeta);
  await linkManagement(commonWell, queryMeta);
}

main();
