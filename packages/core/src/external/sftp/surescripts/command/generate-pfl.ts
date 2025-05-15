#!/usr/bin/env node
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
  
    SureScripts SFTP Integration
        `;
}

const program = new Command();

program
  .command("generate-pfl")
  .description("Generate a PFL file and place into the SFTP directory")
  .addHelpText("before", metriportBanner())
  .showHelpAfterError()
  .version("1.0.0")
  .option("-p, --production", "Generates a file for the production SFTP server")
  .option("-d, --directory <directory>", "The directory to place the PFL file in")
  .action(async () => {
    console.log("Generating PFL file...");
  });

async function main() {
  console.log(metriportBanner());
  program.parse();

  // const options = program.opts();
}

main();
