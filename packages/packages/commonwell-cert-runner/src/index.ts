#!/usr/bin/env node
import {
  PurposeOfUse,
  Person,
  NameUseCodes,
  IdentifierUseCodes,
  AddressUseCodes,
  CommonWell,
  RequestMetadata,
  APIMode,
  getId,
} from "@metriport/commonwell-sdk";
import * as nanoid from "nanoid";
import * as dotenv from "dotenv";
import { Command } from "commander";

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

const program = new Command();
program
  .name("cw-cert-runner")
  .description(
    "Tool to run through Edge System CommonWell certification test cases."
  )
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
  const commonwellPrivateKey = process.env.COMMONWELL_PRIVATE_KEY!;
  const commonwellCert = process.env.COMMONWELL_CERTIFICATE!;
  const commonwellOID = process.env.COMMONWELL_OID!;
  const commonwellOrgName = process.env.COMMONWELL_ORG_NAME!;

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

  // 1. Person Management
  // https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Person-Management-(REST).aspx

  // C1: Enroll a person

  // C1a: Enroll a Person with a Strong ID.
  const caDriversLicenseUri = "urn:oid:2.16.840.1.113883.4.3.6";
  const driversLicenseId = nanoid.nanoid();
  let personStrongId: Person = {
    details: {
      address: [
        {
          use: AddressUseCodes.home,
          zip: "94041",
          state: "CA",
          line: ["335 Pioneer Way"],
          city: "Mountain View",
        },
      ],
      name: [
        {
          use: NameUseCodes.usual,
          given: ["Paul"],
          family: ["Greyham"],
        },
      ],
      gender: {
        code: "M",
      },
      birthDate: "1980-04-20T00:00:00Z",
      identifier: [
        {
          use: IdentifierUseCodes.usual,
          key: driversLicenseId,
          system: caDriversLicenseUri,
          period: {
            start: "1996-04-20T00:00:00Z",
          },
        },
      ],
    },
  };

  const respC1a = await commonWell.enrollPerson(queryMeta, personStrongId);
  console.log(respC1a);

  // C1b: Enroll a Person without a Strong ID.
  let person: Person = {
    details: {
      address: [
        {
          use: AddressUseCodes.home,
          zip: "94111",
          state: "CA",
          line: ["755 Sansome Street"],
          city: "San Francisco",
        },
      ],
      name: [
        {
          use: NameUseCodes.usual,
          given: ["Mary"],
          family: ["Jane"],
        },
      ],
      gender: {
        code: "F",
      },
      birthDate: "2000-04-20T00:00:00Z",
    },
  };

  const respC1b = await commonWell.enrollPerson(queryMeta, person);
  console.log(respC1b);

  // C2: Person search

  // C2a: Search for a Person using the Strong ID.
  const respC2a = await commonWell.searchPerson(
    queryMeta,
    driversLicenseId,
    caDriversLicenseUri
  );
  console.log(respC2a);

  // C2b: Search for a Person using the local Patient demographics.
  // TODO: mplement patient queries

  // C3: Person Update

  // C3a: Update a Person with an existing Strong ID by updating their demographics and/or Strong ID.
  const personId = getId(respC1a);
  personStrongId.details.name[0].family[0] = "Graham";
  const respC3a = await commonWell.updatePerson(
    queryMeta,
    personStrongId,
    personId
  );
  console.log(respC3a);

  // C3b: ​Update a Person without a Strong ID by updating their demographics and/or by adding a Strong ID.
  const personId2 = getId(respC1b);
  const driversLicenseId2 = nanoid.nanoid();
  person.details.identifier = [
    {
      use: IdentifierUseCodes.usual,
      key: driversLicenseId2,
      system: caDriversLicenseUri,
      period: {
        start: "2016-04-20T00:00:00Z",
      },
    },
  ];
  const respC3b = await commonWell.updatePerson(queryMeta, person, personId2);
  console.log(respC3b);

  // C4: ​Patient Match

  // C4a: Search for patients matching the Person demographics.
  // TODO: implement patient queries

  // C6: Unenroll a person

  // C6a: Unenroll a Person who is active
  const respC6a = await commonWell.unenrollPerson(queryMeta, personId2);
  console.log(respC6a);

  // C7: Delete Person

  // C7a: Delete a Person who was previously enrolled with or without a Strong ID and at least one patient link.
  // Note: will be deleting both persons created in this run
  await commonWell.deletePerson(queryMeta, personId);
  await commonWell.deletePerson(queryMeta, personId2);
}

main();
