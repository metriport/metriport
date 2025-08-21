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

/**
 * This script is used to send a batch request to Surescripts by either providing a list of patient IDs or a CSV file.
 * It must be run from within the corresponding VPC (staging or production), otherwise you will generate a valid request
 * file but it will not be received by Surescripts since only a very specific IP set is whitelisted for requests. See 1PW.
 *
 * Usage with patient IDs:
 * npm run surescripts -- batch-request --cx-id <cx-id> --facility-id <facility-id> --patient-ids <patient-ids>
 *
 * The patient IDs should be a comma separated list of UUIDs. The Surescripts client automatically validates that the
 * patient IDs are valid and belong to the given customer and facility.
 *
 * Usage with CSV data:
 * npm run surescripts -- batch-request --cx-id <cx-id> --facility-id <facility-id> --csv-data <csv-data>
 *
 * The CSV file should be an export of the "patient" table from the OSS database containing the specific patients that
 * should be included in the request. This should only be used in situations where the latency of using the Surescripts
 * data mapper (which retrieves data from the internal API) is too high (e.g. for extremely large batch requests of over
 * 10k patients).
 *
 * The script will generate a patient load file, place it into the outgoing replica directory, and write it to the
 * SFTP server.
 */
const program = new Command();

program
  .name("batch-request")
  .requiredOption("--cx-id <cx>", "The CX ID of the requester")
  .requiredOption("--facility-id <facility>", "The facility ID of the requester")
  .option("--patient-ids <patient>", "Specific patient IDs (comma separated) for the request")
  .option("--csv-data <csv>", "The CSV data file to use for patient load")
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
      csvData?: string;
      patientIds?: string;
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
        const { facility, org } = await dataMapper.getFacilityAndOrgData(cxId, facilityId);
        const patients = await getPatientsFromCsv(csvData);
        const client = new SurescriptsSftpClient({
          logLevel: "debug",
        });
        await client.sendBatchRequest({ cxId, facility, org, patients });
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
