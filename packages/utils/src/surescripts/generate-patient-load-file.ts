#!/usr/bin/env node
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { SurescriptsSftpClient } from "@metriport/core/external/sftp/surescripts/client";
import { toSurescriptsPatientLoadFile } from "@metriport/core/external/sftp/surescripts/message";
import { SurescriptsReplica } from "@metriport/core/external/sftp/surescripts/replica";

const program = new Command();

program
  .name("generate-plf")
  .option("-npi, --npi-number <npi>", "The NPI number of the requester")
  .option("-cx, --cx-id <cx>", "The CX ID of the requester")
  .option(
    "-out, --out-dir <dir>",
    "A specified directory location to write the patient load file for manual verification"
  )
  .description("Generate a patient load file and place into the outgoing replica directory")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async () => {
    const { outDir, npiNumber, cxId } = program.opts();
    console.log("Generating patient load file...");

    if (!cxId) throw new Error("CX ID is required");
    if (!npiNumber) throw new Error("NPI number is required");
    if (outDir && !fs.statSync(outDir).isDirectory())
      throw new Error("Output directory must exist");

    const client = new SurescriptsSftpClient({});
    const transmission = client.createEnrollment({
      npiNumber,
      cxId,
    });

    // TODO: patient load source
    const message = toSurescriptsPatientLoadFile(client, transmission, []);

    const fileName = client.getPatientLoadFileName(transmission);
    if (outDir) {
      console.log(`Writing patient load file to ${outDir}`);
      fs.writeFileSync(path.join(outDir, fileName), message, "ascii");
    } else {
      const replica = new SurescriptsReplica({ sftpClient: client });
      await replica.writePatientLoadFileToStorage(transmission, message);
    }
  });

export default program;
