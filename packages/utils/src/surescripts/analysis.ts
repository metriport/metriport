#!/usr/bin/env node
import dotenv from "dotenv";
import csv from "csv-parser";
dotenv.config();

import fs from "fs";

import { Command } from "commander";
import { Bundle } from "@medplum/fhirtypes";
import { SurescriptsConvertPatientResponseHandlerDirect } from "@metriport/core/external/surescripts/command/convert-patient-response/convert-patient-response-direct";
import { SurescriptsReplica } from "@metriport/core/external/surescripts/replica";
import { createConsolidatedDataFileNameWithSuffix } from "@metriport/core/domain/consolidated/filename";
import { dangerouslyDeduplicateFhir } from "@metriport/core/fhir-deduplication/deduplicate-fhir";
import { getEnvVarOrFail } from "@metriport/shared";
import { S3Utils } from "@metriport/core/external/aws/s3";

const program = new Command();
const medicalDocsBucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");

program
  .name("analysis")
  .description("analyze surescripts data for a customer")
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
      if (!csvData) throw new Error("CSV data is required");

      const replica = new SurescriptsReplica();
      const handler = new SurescriptsConvertPatientResponseHandlerDirect(replica);
      const transmissions = await getTransmissionsFromCsv(cxId, csvData);

      for (const { patientId, transmissionId } of transmissions) {
        const [consolidatedBundle, conversionBundle] = await Promise.all([
          getConsolidatedBundle(cxId, patientId),
          handler.convertPatientResponse({
            cxId,
            facilityId,
            populationId: patientId,
            transmissionId,
          }),
        ]);

        if (!consolidatedBundle) {
          console.log(`No consolidated bundle found for patient ${patientId}`);
          continue;
        }
        if (!conversionBundle) {
          console.log(`No conversion bundle generated for patient ${patientId}`);
          continue;
        }
        dangerouslyDeduplicateFhir(consolidatedBundle, cxId, patientId);

        const currentEntries = consolidatedBundle.entry?.length ?? 0;
        const conversionEntries = conversionBundle.bundle.entry?.length ?? 0;

        consolidatedBundle.entry?.push(...(conversionBundle.bundle.entry ?? []));
        dangerouslyDeduplicateFhir(consolidatedBundle, cxId, patientId);

        const newEntries = consolidatedBundle.entry?.length ?? 0;
        const addedEntries = newEntries - currentEntries;

        const displayCount = `Deduplicate(Consolidated[...${currentEntries}] + Surescripts[...${conversionEntries}]) = New Consolidated[...${newEntries}]`;

        console.log(
          displayCount.padEnd(90, " ") +
            `(+${Math.round((100.0 * addedEntries) / conversionEntries)}% of SS data)`
        );
      }
    }
  );

async function getConsolidatedBundle(cxId: string, patientId: string): Promise<Bundle | undefined> {
  const s3Utils = new S3Utils("us-west-1");
  const fileKey = createConsolidatedDataFileNameWithSuffix(cxId, patientId) + ".json";
  if (!(await s3Utils.fileExists(medicalDocsBucketName, fileKey))) {
    return undefined;
  }
  const fileContent = await s3Utils.downloadFile({ bucket: medicalDocsBucketName, key: fileKey });
  return JSON.parse(fileContent.toString());
}

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
