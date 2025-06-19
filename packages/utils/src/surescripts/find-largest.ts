#!/usr/bin/env node
import dotenv from "dotenv";
import csv from "csv-parser";
dotenv.config();

import fs from "fs";
import path from "path";

import { Command } from "commander";
import { SurescriptsReplica } from "@metriport/core/external/surescripts/replica";
import { parseResponseFile } from "@metriport/core/external/surescripts/file/file-parser";
import { buildCsvPath } from "./shared";

const program = new Command();
const dataPoints: Array<{ patientId: string; transmissionId: string; size: number }> = [];
const reportingThreshold = 200;

program
  .name("find-largest")
  .description("find largest surescripts responses for a customer")
  .option("--cx-id <cxId>", "The customer ID")
  .option("--facility-id <facilityId>", "The facility ID")
  .option("--csv-data <csvData>", "The CSV data with patient IDs and transmission IDs")
  .action(
    async ({
      cxId,
      facilityId,
      csvData,
    }: {
      cxId: string;
      facilityId: string;
      csvData: string;
    }) => {
      if (!cxId) throw new Error("Customer ID is required");
      if (!facilityId) throw new Error("Facility ID is required");
      if (!csvData) throw new Error("Either patient ID or CSV data is required");
      csvData = buildCsvPath(csvData);

      const replica = new SurescriptsReplica();
      const transmissions = await getTransmissionsFromCsv(cxId, csvData);
      let totalProcessed = 0;

      for (const { patientId, transmissionId } of transmissions) {
        const file = await replica.getRawResponseFile({ transmissionId, populationId: patientId });
        if (!file) {
          console.log(`No file found for patient ${patientId} and transmission ${transmissionId}`);
          continue;
        }
        const parsedFile = parseResponseFile(file);
        const size = parsedFile.details.length;
        dataPoints.push({
          patientId,
          transmissionId,
          size,
        });
        if (size >= reportingThreshold) {
          console.log(`Found large patient: ${patientId} (${size} entries)`);
          console.log(
            `  npm run surescripts -- preview --cx-id ${cxId} --facility-id ${facilityId} --patient-id ${patientId} --transmission-id ${transmissionId}`
          );
        }
        totalProcessed++;
        if (totalProcessed % 100 === 0) {
          console.log(`Processed ${totalProcessed} patients`);
        }
      }

      dataPoints.sort((a, b) => b.size - a.size);

      // Write the response data frequency to a CSV file
      const csvContent =
        '"' +
        ["patient_id", "transmission_id", "size"].join('","') +
        '"\n' +
        dataPoints
          .map(({ patientId, transmissionId, size }) => {
            return [`"${patientId}"`, `"${transmissionId}"`, `"${size}"`].join(",");
          })
          .join("\n");
      fs.writeFileSync(
        path.join(process.cwd(), "runs/surescripts/largest_patients.csv"),
        csvContent,
        "utf-8"
      );
    }
  );

interface PatientTransmission {
  cxId: string;
  patientId: string;
  transmissionId: string;
}

async function getTransmissionsFromCsv(
  cxId: string,
  csvData: string
): Promise<PatientTransmission[]> {
  return new Promise((resolve, reject) => {
    const transmissions: PatientTransmission[] = [];
    fs.createReadStream(csvData)
      .pipe(csv())
      .on("data", function (row) {
        transmissions.push({
          cxId,
          patientId: row.patient_id,
          transmissionId: row.transmission_id,
        });
      })
      .on("end", function () {
        resolve(transmissions);
      })
      .on("error", function (error) {
        reject(error);
      });
  });
}

export default program;
