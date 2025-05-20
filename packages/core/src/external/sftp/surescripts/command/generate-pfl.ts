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
  .argument("<facilityId>", "The customer's facility ID")
  .option("--patient <ids>", "Comma separate list of patient IDs")
  .description("Generate a PFL file and place into the outgoing S3 location")
  .addHelpText("before", metriportBanner())
  .showHelpAfterError()
  .version("1.0.0");

async function main() {
  program.parse();

  const cxId = program.args[0];
  const facilityId = program.args[1];
  if (!cxId || !facilityId) {
    throw new Error("cxId and facilityId are required");
  }

  const { patientIds } = program.opts();
  const patientIdsArray = patientIds ? patientIds.split(",") : [];

  if (!patientIds) {
    // Load all patients for the facility
    // const patients = await getPatients({ cxId, facilityId });
    patientIdsArray.push("abc-123");
  }

  if (patientIdsArray.length === 0) {
    throw new Error("No patient IDs retrieved");
  }
}

main();
