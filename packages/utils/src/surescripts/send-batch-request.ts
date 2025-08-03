#!/usr/bin/env node
import dotenv from "dotenv";
import csv from "csv-parser";
import fs from "fs";
dotenv.config();

import { Command } from "commander";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";
import { SurescriptsDataMapper } from "@metriport/core/external/surescripts/data-mapper";
import { SurescriptsSendBatchRequestHandlerDirect } from "@metriport/core/external/surescripts/command/send-batch-request/send-batch-request-direct";
import { Patient } from "@metriport/shared/domain/patient";

const program = new Command();

program
  .name("batch-request")
  .requiredOption("--cx-id <cx>", "The CX ID of the requester")
  .requiredOption("--facility-id <facility>", "The facility ID of the requester")
  .requiredOption(
    "--patient-ids <patient>",
    "Specific patient IDs (comma separated) for the request"
  )
  .requiredOption("--csv-data <csv>", "The CSV data file to use for patient load")
  .description("Generate a patient load file and place into the outgoing replica directory")
  .showHelpAfterError()
  .version("1.0.0")
  .action(
    async ({
      cxId,
      facilityId,
      csvData,
      patientIds,
    }: {
      cxId: string;
      facilityId: string;
      csvData: string;
      patientIds: string;
    }) => {
      if (patientIds) {
        const handler = new SurescriptsSendBatchRequestHandlerDirect(
          new SurescriptsSftpClient({
            logLevel: "debug",
          })
        );
        await handler.sendBatchRequest({ cxId, facilityId, patientIds: patientIds.split(",") });
      } else if (csvData) {
        const dataMapper = new SurescriptsDataMapper();
        const facility = await dataMapper.getFacilityData(cxId, facilityId);
        const patients = await getPatientsFromCsv(csvData);
        const client = new SurescriptsSftpClient({
          logLevel: "debug",
        });
        await client.sendBatchRequest({ cxId, facility, patients });
      } else {
        throw new Error("Patient IDs or CSV data is required");
      }
    }
  );

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
