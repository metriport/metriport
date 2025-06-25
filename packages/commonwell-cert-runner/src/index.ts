import * as dotenv from "dotenv";
// keep that ^ above all other imports
import { Command } from "commander";
import { linkManagement } from "./flows/link-management";
import { orgManagement } from "./flows/org-management";
import { patientManagement } from "./flows/patient-management";

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

  // TODO ENG-200 address this
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

  try {
    // Run through the CommonWell certification test cases
    const { commonWell, orgQueryMeta } = await orgManagement();
    await patientManagement(commonWell, orgQueryMeta);
    await linkManagement(commonWell, orgQueryMeta);
    // await personManagement(commonWell, queryMeta);
    // await patientManagement(commonWell, commonWellSandbox, queryMeta);
    // await documentConsumption(commonWell, queryMeta);
    // await documentContribution({ memberManagementApi: commonWellMember, api: commonWell, queryMeta });

    // Issue #425
    // await patientLinksWithStrongIds(commonWell, queryMeta);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error(`Error (${error.response?.status}): ${error.message}`);
    if (error.response?.data) {
      console.error(JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();
