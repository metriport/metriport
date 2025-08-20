import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ above all other imports
import { Command } from "commander";
import { documentConsumption } from "./flows/document-consumption";
import { documentContribution } from "./flows/document-contribution";
import { linkManagement } from "./flows/link-management";
import { orgManagement } from "./flows/org-management";
import { patientManagement } from "./flows/patient-management";
import { logError } from "./util";

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

  const failedFlows: string[] = [];
  try {
    // Run through the CommonWell certification test cases
    const { commonWell } = await orgManagement();
    await patientManagement(commonWell).catch(() => failedFlows.push("patientManagement"));
    await linkManagement(commonWell).catch(() => failedFlows.push("linkManagement"));
    await documentConsumption(commonWell).catch(() => failedFlows.push("documentConsumption"));
    await documentContribution(commonWell).catch(() => failedFlows.push("documentContribution"));

    if (failedFlows.length < 1) {
      console.error(`\n>>> >>> All flows passed! <<< <<<\n`);
      process.exit(0);
    } else {
      console.error(`\n>>> >>> Failed flows:\n- ${failedFlows.join("\n- ")}\n`);
      process.exit(1);
    }
  } catch (error) {
    logError(error);
    process.exit(1);
  }
}

main();
