#!/usr/bin/env node
import path from "path";
import dotenv from "dotenv";
dotenv.config({
  path: path.resolve(__dirname, "../../../../../.env"),
});

import { Command } from "commander";
// import { SurescriptsSftpClient, Transmission } from "../client";

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
  .description("Generate a PFL file and place into the outgoing S3 location")
  .addHelpText("before", metriportBanner())
  .showHelpAfterError()
  .version("1.0.0")
  // .option("-p, --production", "Generates a file for the production SFTP server")
  .action(async () => {
    console.log("Generating PFL file...");
  });

async function main() {
  // console.log(metriportBanner());
  program.parse();

  // const options = program.opts();
  console.log("password", process.env.SURESCRIPTS_SFTP_SANDBOX_SENDER_PASSWORD);

  // const client = new SurescriptsSftpClient({
  //   usage: 'test',
  //   username: "test",
  //   password: "test",
  //   senderId: "test",
  //   senderPassword: "test",
  //   privateKey: "test",
  // });

  // const transmission =
}

main();
