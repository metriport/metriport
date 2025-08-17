#!/usr/bin/env node
import { APIMode, CommonWell, RequestMetadata } from "@metriport/commonwell-sdk";
import { PurposeOfUse } from "@metriport/shared";
import { Command } from "commander";
import * as dotenv from "dotenv";
import { documentConsumption } from "./document-consumption";
import { documentContribution } from "./document-contribution";
import { linkManagement } from "./link-management";
import { orgManagement } from "./org-management";
import { patientManagement } from "./patient-management";
import { personManagement } from "./person-management";
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
COMMONWELL_ORG_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
fkadsjhfhdsakjfhdsakhfkdsahfadshfkhdsfhdsakfdhafkashdfkjhalsdkjf
-----END PRIVATE KEY-----
"
COMMONWELL_ORG_CERTIFICATE="-----BEGIN CERTIFICATE-----
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
  const commonwellOrgPrivateKey = getEnvOrFail("COMMONWELL_ORG_PRIVATE_KEY");
  const commonwellOrgCert = getEnvOrFail("COMMONWELL_ORG_CERTIFICATE");
  const commonwellOID = getEnvOrFail("COMMONWELL_OID");
  const commonwellOrgName = getEnvOrFail("COMMONWELL_ORG_NAME");

  const commonWell = new CommonWell(
    commonwellOrgCert,
    commonwellOrgPrivateKey,
    commonwellOrgName,
    commonwellOID,
    APIMode.integration
  );

  // Sandbox Account Org
  const commonwellSandboxOID = getEnvOrFail("COMMONWELL_SANDBOX_OID");
  const commonwellSandboxOrgName = getEnvOrFail("COMMONWELL_SANDBOX_ORG_NAME");

  const commonWellSandbox = new CommonWell(
    commonwellOrgCert,
    commonwellOrgPrivateKey,
    commonwellSandboxOrgName,
    commonwellSandboxOID,
    APIMode.integration
  );

  // Member Account Org
  const commonwellMemberOID = getEnvOrFail("COMMONWELL_MEMBER_OID");
  const commonwellMemberPrivateKey = getEnvOrFail("COMMONWELL_MEMBER_PRIVATE_KEY");
  const commonwellMemberCert = getEnvOrFail("COMMONWELL_MEMBER_CERTIFICATE");

  const commonWellMember = new CommonWell(
    commonwellMemberCert,
    commonwellMemberPrivateKey,
    commonwellOrgName,
    commonwellMemberOID,
    APIMode.integration
  );

  const queryMeta: RequestMetadata = {
    purposeOfUse: PurposeOfUse.TREATMENT,
    role: "ict",
    subjectId: "admin",
  };

  // Run through the CommonWell certification test cases

  await orgManagement(commonWellMember, queryMeta);
  await personManagement(commonWell, queryMeta);
  await patientManagement(commonWell, commonWellSandbox, queryMeta);
  await linkManagement(commonWell, queryMeta);
  await documentConsumption(commonWell, queryMeta);
  await documentContribution({ memberManagementApi: commonWellMember, api: commonWell, queryMeta });

  // Issue #425Ø
  // await patientLinksWithStrongIds(commonWell, queryMeta);
}

main();
