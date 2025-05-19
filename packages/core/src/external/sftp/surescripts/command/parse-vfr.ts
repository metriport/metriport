#!/usr/bin/env node
import path from "path";
import dotenv from "dotenv";
dotenv.config({
  path: path.resolve(__dirname, "../../../../../.env"),
});

import { Command } from "commander";
import { SurescriptsSftpClient } from "../client";
// import { toSurescriptsMessage } from "../message";
import { metriportBanner } from "./shared";
const program = new Command();

program
  .description("Generate a PFL file and place into the outgoing S3 location")
  .addHelpText("before", metriportBanner())
  .showHelpAfterError()
  .version("1.0.0");

async function main() {
  // console.log(metriportBanner());
  program.parse();

  // const options = program.opts();

  const client = new SurescriptsSftpClient({});

  await client.connect();

  // get VRF file from transmission object

  // const message = toSurescriptsMessage(client, transmission, "cxId", Facility, Patient[]);
  // await client.put(transmission.fileName, message);

  await client.disconnect();
}

main();
