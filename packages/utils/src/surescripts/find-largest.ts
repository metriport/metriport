#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import { Command } from "commander";
import { SurescriptsReplica } from "@metriport/core/external/surescripts/replica";
import { parseResponseFile } from "@metriport/core/external/surescripts/file/file-parser";
import { buildCsvPath, getTransmissionsFromCsv } from "./shared";
import { initRunsFolder, buildGetDirPathInside } from "../shared/folder";

const program = new Command();

initRunsFolder("surescripts");
const getDirPath = buildGetDirPathInside("surescripts");
const replica = new SurescriptsReplica();
const dataPoints: Array<{ patientId: string; transmissionId: string; size: number }> = [];
const reportingThreshold = 200;

program
  .name("find-largest")
  .description("find largest surescripts responses for a customer")
  .option("--cx-id <cxId>", "The customer ID")
  .option("--facility-id <facilityId>", "The facility ID")
  .option("--org-name <orgName>", "The organization name")
  .option("--csv-data <csvData>", "The CSV data with patient IDs and transmission IDs")
  .action(
    async ({
      cxId,
      facilityId,
      orgName,
      csvData,
    }: {
      cxId: string;
      facilityId: string;
      orgName?: string;
      csvData: string;
    }) => {
      if (!cxId) throw new Error("Customer ID is required");
      if (!facilityId) throw new Error("Facility ID is required");
      if (!csvData) throw new Error("Either patient ID or CSV data is required");
      csvData = buildCsvPath(csvData);
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
      fs.writeFileSync(path.join(getDirPath(orgName), "largest_patients.csv"), csvContent, "utf-8");
    }
  );

export default program;
