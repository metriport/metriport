import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ above all other imports
import { Command } from "commander";
import { documentConsumption } from "./flows/document-consumption";
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
  .description("Tool to run through the CommonWell onboarding/certification cases.")
  .addHelpText("before", metriportBanner())
  .showHelpAfterError()
  .version("2.x");

async function main() {
  console.log(metriportBanner());
  program.parse();

  try {
    // Run through the CommonWell certification test cases
    const { commonWell } = await orgManagement();
    await patientManagement(commonWell);
    await linkManagement(commonWell);
    await documentConsumption(commonWell);
    // await documentContribution({ memberManagementApi: commonWellMember, api: commonWell, queryMeta });

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
