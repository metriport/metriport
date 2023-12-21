#!/usr/bin/env node

import { Command, Option } from "commander";
import { makeJwt } from "@metriport/commonwell-sdk";
import { PurposeOfUse } from "@metriport/shared";
import * as fs from "fs";

const rsaKeyOpt = "rsa-key";
const roleOpt = "role";
const subjectIdOpt = "subject-id";
const orgNameOpt = "org-name";
const oidOpt = "oid";
const pouOpt = "pou";
const npiOpt = "npi";
const payloadHashOpt = "payload-hash";
const program = new Command();

program
  .name("cw-jwt-maker")
  .description("CLI to create a JWT for use in CommonWell queries.")
  .requiredOption(
    `--${rsaKeyOpt} <file-path>`,
    "Absolute path to the RSA256 private key file corresponding to the specified organization's public key (certificate) - used for signing the JWT."
  )
  .requiredOption(
    `--${roleOpt} <practitioner-role>`,
    "The practitioner role of the entity making this request. Valid role values: https://hl7.org/fhir/R4/valueset-practitioner-role.html"
  )
  .requiredOption(
    `--${subjectIdOpt} <subject-id>`,
    "Free text field used for audit purposes. The value should be user ID or user name of staff using the CommonWell enabled system. Can be a system user if the API call is generated from an automated process instead of an actual user."
  )
  .requiredOption(
    `--${orgNameOpt} <organization-name>`,
    "The organization name for the request correspondint to the specified OID."
  )
  .requiredOption(
    `--${oidOpt} <organization-id>`,
    "OID of the org making the request. CW uses this ID to certificate in order to validate the signature on the token."
  )
  .addOption(
    new Option(`--${pouOpt} <purpose-of-use>`, "The purpose of use (POU) for this request.")
      .choices(Object.values(PurposeOfUse))
      .makeOptionMandatory(true)
  )
  .option(`--${npiOpt} [npi-number]`, "Ten digit National Provider Identifier (optional).")
  .option(
    `--${payloadHashOpt} [payload-hash]`,
    "Only required for Patient IDLink - MurmurHash2 calculation of HTTP POST body (optional)."
  )
  .addHelpText(
    "before",
    `
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

     CommonWell JWT Maker
      `
  )
  .showHelpAfterError()
  .version("1.0.0");

program.parse();
const options = program.opts();
const rsaPrivateKey = fs.readFileSync(options.rsaKey);

async function main() {
  const jwt = await makeJwt(
    rsaPrivateKey.toString(),
    options.role,
    options.subjectId,
    options.orgName,
    options.oid,
    options.pou,
    options.npi,
    options.payloadHash
  );
  console.log(jwt);
}

main();
