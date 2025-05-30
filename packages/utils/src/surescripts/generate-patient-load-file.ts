#!/usr/bin/env node
import dotenv from "dotenv";
import csv from "csv-parser";
import fs from "fs";
dotenv.config();

import { Command } from "commander";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";
import { SurescriptsApi } from "@metriport/core/external/surescripts/api";
import { Patient } from "@metriport/shared/domain/patient";
import { filePathIsInGitRepository } from "./shared";

const program = new Command();

program
  .name("generate-plf")
  .option("-c, --cx-id <cx>", "The CX ID of the requester")
  .option("-f, --facility-id <facility>", "The facility ID of the requester")
  .option("-n, --npi-number <npi>", "The NPI number of the requester, used for CSV data")
  .option("--csv-data <csv>", "The CSV data file to use for patient load")
  .description("Generate a patient load file and place into the outgoing replica directory")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async () => {
    const { cxId, facilityId, csvData, npiNumber } = program.opts();
    console.log("Generating patient load file...");

    if (!cxId) throw new Error("CX ID is required");
    if (!facilityId) throw new Error("Facility ID is required");

    const api = new SurescriptsApi();
    const client = new SurescriptsSftpClient({});

    if (csvData) {
      if (!npiNumber) throw new Error("NPI number is required when using CSV data");
      await generatePatientLoadFileFromCsv(client, { cxId, npiNumber, csvData });
      return;
    }

    const customer = await api.getCustomer(cxId);
    const facility = customer.facilities.find(f => f.id === facilityId);

    if (!facility) throw new Error(`Facility ${facilityId} not found`);

    const transmission = client.createEnrollment({
      npiNumber: facility.npi,
      cxId,
    });

    const patientIds = await api.getPatientIds(cxId, facilityId);
    const patients = await Promise.all(patientIds.map(id => api.getPatient(cxId, id)));
    console.log("Found " + patients.length + " patients");

    const message = client.generatePatientLoadFile(transmission, patients);
    console.log(message.toString("ascii"));

    await client.writePatientLoadFileToStorage(transmission, message);
    console.log("Patient load file written to storage");
    console.log("      Transmission ID:  " + transmission.id);
    console.log("    Request file name:  " + transmission.requestFileName);
    console.log("Tranmission timestamp:  " + transmission.timestamp);
    console.log("            File size:  " + message.length + " bytes");
  });

async function generatePatientLoadFileFromCsv(
  client: SurescriptsSftpClient,
  { cxId, npiNumber, csvData }: { npiNumber: string; cxId: string; csvData: string }
): Promise<void> {
  if (filePathIsInGitRepository(csvData)) {
    throw new Error("CSV data file must not be in a git repository");
  }

  const patients = await getPatientsFromCsv(csvData);
  console.log("Found " + patients.length + " patients");

  const transmission = client.createEnrollment({
    npiNumber,
    cxId,
  });

  const message = client.generatePatientLoadFile(transmission, patients);
  // console.log(message.toString("ascii"));

  await client.writePatientLoadFileToStorage(transmission, message);
  console.log("Patient load file written to storage");
}

async function getPatientsFromCsv(csvData: string): Promise<Patient[]> {
  return new Promise((resolve, reject) => {
    const patients: Patient[] = [];
    fs.createReadStream(csvData)
      .pipe(csv())
      .on("data", function (row) {
        const data = JSON.parse(row.data);
        data.id = row.id;
        data.facilityIds = row.facility_ids
          ? row.facility_ids.substring(1, row.facility_ids.length - 1).split(",")
          : [];
        patients.push({
          id: data.id,
          firstName: data.firstName,
          lastName: data.lastName,
          dob: data.dob,
          dateCreated: data.dateCreated,
          genderAtBirth: data.genderAtBirth,
          address: data.address,
          facilityIds: data.facilityIds,
          phoneNumber: data.consolidatedLinkDemographics?.telephoneNumbers?.[0],
        });
      })
      .on("end", function () {
        resolve(patients);
      })
      .on("error", function (error) {
        reject(error);
      });
  });
}

export default program;
