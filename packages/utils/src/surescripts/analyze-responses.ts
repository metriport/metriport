#!/usr/bin/env node
import dotenv from "dotenv";
import csv from "csv-parser";
dotenv.config();

import fs from "fs";

import { Command } from "commander";
import { SurescriptsReplica } from "@metriport/core/external/surescripts/replica";
import { parseResponseFile } from "@metriport/core/external/surescripts/file/file-parser";
import path from "path";

const program = new Command();

const responseDataFrequency: Record<string, Record<string, number>> = {};
const frequencyThreshold = 1;
const sampleSize: number | undefined = undefined;
const ignoreKeys: Set<string> = new Set(["messageId", "sentTime"]);

function isPhiKey(key: string): boolean {
  return key.startsWith("patient");
}

function insertIntoResponseDataFrequency(key: string, value?: string | number | Date | boolean) {
  if (isPhiKey(key) || value == null) return;
  if (ignoreKeys.has(key)) return;
  if (!responseDataFrequency[key]) {
    responseDataFrequency[key] = {};
  }
  const stringValue = String(value);
  const currentCount = responseDataFrequency[key][stringValue] ?? 0;
  responseDataFrequency[key][stringValue] = currentCount + 1;
}

program
  .name("analyze-responses")
  .description("analyze surescripts data for a customer")
  .option("--raw", "Whether to return the raw responses")
  .option("--cx-id <cxId>", "The customer ID")
  .option("--facility-id <facilityId>", "The facility ID")
  .option("--patient-id <patientId>", "An optional patient ID")
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

      const replica = new SurescriptsReplica();
      let transmissions = await getTransmissionsFromCsv(cxId, csvData);
      if (sampleSize) transmissions = transmissions.slice(0, sampleSize);
      let totalProcessed = 0;

      for (const { patientId, transmissionId } of transmissions) {
        const file = await replica.getRawResponseFile({ transmissionId, populationId: patientId });
        if (!file) {
          console.log(`No file found for patient ${patientId} and transmission ${transmissionId}`);
          continue;
        }
        const parsedFile = parseResponseFile(file);
        parsedFile.details.forEach(({ data }) => {
          Object.keys(data).forEach(key => {
            insertIntoResponseDataFrequency(key, data[key as keyof typeof data]);
          });
        });
        totalProcessed++;
        if (totalProcessed % 100 === 0) {
          console.log(`Processed ${totalProcessed} patients`);
        }
      }

      // Write the response data frequency to a CSV file
      const csvContent =
        '"' +
        ["key", "value", "count"].join('","') +
        '"\n' +
        Object.entries(responseDataFrequency)
          .flatMap(([key, valueMap]) => {
            return Object.entries(valueMap)
              .sort(([, a], [, b]) => b - a)
              .map(([value, count]) => {
                if (count < frequencyThreshold) return null;
                return [`"${key}"`, `"${value}"`, `"${count}"`].join(",");
              })
              .filter(Boolean);
          })
          .join("\n");
      fs.writeFileSync(
        path.join(process.cwd(), "runs/surescripts/response_data_frequency.csv"),
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
