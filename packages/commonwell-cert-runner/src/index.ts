import * as dotenv from "dotenv";
// keep that ^ above all other imports
import { APIMode, CommonWell, RequestMetadata } from "@metriport/commonwell-sdk";
import { PurposeOfUse } from "@metriport/shared";
import { Command } from "commander";
import {
  memberCertificateString,
  memberId,
  memberName,
  memberPrivateKeyString,
  orgCertificateString,
  orgPrivateKeyString,
} from "./env";
import { orgManagement } from "./org-management";
import { patientManagement } from "./patient-management";
// import { getEnvOrFail } from "./util";

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
    `Absolute path to the .env file containing required config. Example required file contents on README.md`
  )
  .addHelpText("before", metriportBanner())
  .showHelpAfterError()
  .version("1.0.0");

async function main() {
  console.log(metriportBanner());
  program.parse();
  const options = program.opts();
  dotenv.config({ path: options.envFile });

  // // Sandbox Account Org
  // const commonwellSandboxOID = getEnvOrFail("CW_SANDBOX_ORG_OID");
  // const commonwellSandboxOrgName = getEnvOrFail("CW_SANDBOX_ORG_NAME");
  // const commonWellSandbox = new CommonWell(
  //   commonwellOrgCert,
  //   commonwellOrgPrivateKey,
  //   commonwellSandboxOrgName,
  //   commonwellSandboxOID,
  //   APIMode.integration
  // );

  // Run through the CommonWell certification test cases

  // try {
  const memberQueryMeta: RequestMetadata = {
    purposeOfUse: PurposeOfUse.TREATMENT,
    role: "ict",
    subjectId: "admin",
  };
  const commonWellMember = new CommonWell(
    memberCertificateString,
    memberPrivateKeyString,
    memberName,
    memberId,
    APIMode.integration
  );
  const org = await orgManagement(commonWellMember, memberQueryMeta);

  const orgQueryMeta: RequestMetadata = {
    purposeOfUse: PurposeOfUse.TREATMENT,
    role: "ict",
    subjectId: `${org.name} System User`,
  };
  const commonWell = new CommonWell(
    orgCertificateString,
    orgPrivateKeyString,
    org.name,
    org.organizationId,
    APIMode.integration
  );
  await patientManagement(commonWell, orgQueryMeta);
  // await personManagement(commonWell, queryMeta);
  // await patientManagement(commonWell, commonWellSandbox, queryMeta);
  // await linkManagement(commonWell, queryMeta);
  // await documentConsumption(commonWell, queryMeta);
  // await documentContribution({ memberManagementApi: commonWellMember, api: commonWell, queryMeta });

  // Issue #425Ø
  // await patientLinksWithStrongIds(commonWell, queryMeta);
  // } catch (error: any) {
  //   console.error(`Error (${error.response?.status}): ${error.message}`);
  //   console.error(JSON.stringify(error.response?.data ?? error, null, 2));
  //   // console.error(error);
  //   process.exit(1);
  // }
}

main();
