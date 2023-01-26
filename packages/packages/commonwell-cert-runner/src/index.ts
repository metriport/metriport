#!/usr/bin/env node
import { APIMode, CommonWell, PurposeOfUse, RequestMetadata } from "@metriport/commonwell-sdk";
import { Command } from "commander";
import * as dotenv from "dotenv";
import { personManagement } from "./person-management";

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

function getEnvOrFail(name) {
  const value = process.env[name];
  if (!value || value.trim().length < 1) throw new Error(`Missing env var ${name}`);
  return value;
}

const program = new Command();
program
  .name("cw-cert-runner")
  .description("Tool to run through Edge System CommonWell certification test cases.")
  .requiredOption(
    `--env-file <file-path>`,
    `Absolute path to the .env file containing required config. Example required file contents:

COMMONWELL_ORG_NAME=Metriport
COMMONWELL_OID=2.16.840.1.113883.3.9621
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

  const queryMeta: RequestMetadata = {
    purposeOfUse: PurposeOfUse.TREATMENT,
    role: "ict",
    subjectId: "admin",
  };

  // Run through the CommonWell certification test cases

  await personManagement(commonWell, queryMeta);
}

main();
