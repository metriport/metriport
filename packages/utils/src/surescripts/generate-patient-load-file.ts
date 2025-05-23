#!/usr/bin/env node
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import csv from "csv-parser";
dotenv.config();

import { Command } from "commander";
import { SurescriptsSftpClient } from "@metriport/core/external/sftp/surescripts/client";
import { toSurescriptsPatientLoadFile } from "@metriport/core/external/sftp/surescripts/message";
import { SurescriptsReplica } from "@metriport/core/external/sftp/surescripts/replica";
import { Patient } from "@metriport/core/domain/patient";
import { filePathIsInGitRepository } from "./shared";

const program = new Command();

program
  .name("generate-plf")
  .option("-npi, --npi-number <npi>", "The NPI number of the requester")
  .option("-cx, --cx-id <cx>", "The CX ID of the requester")
  .option("-d, --patient-data <file>", "A patient data source to use")
  .option(
    "-out, --out-dir <dir>",
    "A specified directory location to write the patient load file for manual verification"
  )
  .description("Generate a patient load file and place into the outgoing replica directory")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async () => {
    const { outDir, npiNumber, cxId, patientData } = program.opts();
    console.log("Generating patient load file...");

    if (!cxId) throw new Error("CX ID is required");
    if (!npiNumber) throw new Error("NPI number is required");
    if (outDir && !fs.statSync(outDir).isDirectory())
      throw new Error("Output directory must exist");
    if (!patientData || !fs.statSync(patientData).isFile())
      throw new Error("Patient data source must be a file");
    if (filePathIsInGitRepository(patientData))
      throw new Error("Patient data source must not be in a git repository");

    const client = new SurescriptsSftpClient({});
    const transmission = client.createEnrollment({
      npiNumber,
      cxId,
    });

    const patients = await readPatientData(patientData);
    console.log(`Read ${patients.length} patients from ${patientData}`);
    console.log(patients);

    // TODO: patient load source
    const message = toSurescriptsPatientLoadFile(client, transmission, patients);

    const fileName = client.getPatientLoadFileName(transmission);
    if (outDir) {
      console.log(`Writing patient load file to ${outDir}`);
      fs.writeFileSync(path.join(outDir, fileName), message, "ascii");
    } else {
      const replica = new SurescriptsReplica({ sftpClient: client });
      await replica.writePatientLoadFileToStorage(transmission, message);
    }
  });

async function readPatientData(patientData: string): Promise<Patient[]> {
  const promise = new Promise<Patient[]>(function (resolve, reject) {
    const patients: Patient[] = [];
    const headers: string[] = [];
    fs.createReadStream(patientData)
      .pipe(
        csv({
          mapHeaders: ({ header }: { header: string }) => {
            return header.replace(/[!@#$%^&*()+=\[\]\\';,./{}|":<>?~_\s]/gi, ""); //eslint-disable-line
          },
        })
      )
      .on("headers", async (parsedHeaders: string[]) => {
        headers.push(...parsedHeaders);
      })
      .on("data", async data => {
        try {
          patients.push(data);
        } catch (error) {
          reject(error);
        }
      })
      .on("end", async () => {
        return resolve(patients);
      })
      .on("error", reject);
  });
  return await promise;
}

export default program;
