#!/usr/bin/env node
import path from "path";
import dotenv from "dotenv";
// import { SurescriptsSftpClient, TransmissionType } from "../client";

dotenv.config({
  path: path.resolve(__dirname, "../../../../../.env"),
});

import { Command } from "commander";
import { metriportBanner } from "./shared";
const program = new Command();

// import { getFacilities } from "@metriport/api/command/medical/facility/get-facility";

program
  .argument("<cxId>", "The cxId of the customer")
  .description("Generate a PFL file and place into the outgoing S3 location")
  .addHelpText("before", metriportBanner())
  .showHelpAfterError()
  .version("1.0.0");

async function main() {
  program.parse();

  const cxId = program.args[0];
  if (!cxId) {
    throw new Error("cxId is required");
  }

  // generate PFL file
  // const client = new SurescriptsSftpClient({});
  // const transmission = client.createTransmission(TransmissionType.Enroll, cxId);

  // const facilities = await getFacilities({ cxId });

  // for (const facility of facilities) {
  // const message = toSurescriptsMessage(client, transmission, cxId, Facility, Patient[]);
  // await client.put(transmission.fileName, message);
  // }
}

main();
