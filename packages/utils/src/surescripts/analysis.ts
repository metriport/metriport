#!/usr/bin/env node
import dotenv from "dotenv";
import csv from "csv-parser";
dotenv.config();

import fs from "fs";

import { Command } from "commander";
import { SurescriptsConvertPatientResponseHandlerDirect } from "@metriport/core/external/surescripts/command/convert-patient-response/convert-patient-response-direct";
import { SurescriptsReplica } from "@metriport/core/external/surescripts/replica";
import { getEnvVarOrFail } from "@metriport/shared";
import { createConsolidatedDataFileNameWithSuffix } from "@metriport/core/domain/consolidated/filename";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { Bundle, Medication } from "@medplum/fhirtypes";

const program = new Command();
const medicalDocsBucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");

program
  .name("analysis")
  .description("analyze surescripts data for a customer")
  .option("--cx-id <cxId>", "The customer ID")
  .option("--csv-data <csvData>", "The CSV data with patient IDs and transmission IDs")
  .action(async ({ cxId, csvData }: { cxId: string; csvData: string }) => {
    if (!cxId) throw new Error("Customer ID is required");
    if (!csvData) throw new Error("CSV data is required");

    const replica = new SurescriptsReplica();
    const handler = new SurescriptsConvertPatientResponseHandlerDirect(replica);
    let transmissions = await getTransmissionsFromCsv(cxId, csvData);
    transmissions = transmissions.slice(0, 10);

    for (const transmission of transmissions) {
      const [consolidatedBundle, conversionBundle] = await Promise.all([
        getConsolidatedBundle(cxId, transmission.patientId),
        handler.convertPatientResponse({
          populationId: transmission.patientId,
          transmissionId: transmission.transmissionId,
        }),
      ]);

      if (!consolidatedBundle) {
        console.log(`No consolidated bundle found for patient ${transmission.patientId}`);
        continue;
      }
      if (!conversionBundle) {
        console.log(`No conversion bundle generated for patient ${transmission.patientId}`);
        continue;
      }
      const consolidatedMedications = extractMedications(consolidatedBundle);
      const conversionMedications = extractMedications(conversionBundle.bundle);

      console.log("existing", consolidatedMedications);
      console.log("surescripts", conversionMedications);
    }
  });

function extractMedications(bundle: Bundle): Medication[] {
  return (
    bundle.entry
      ?.filter(entry => entry.resource?.resourceType === "Medication")
      .map(entry => entry.resource as Medication) || []
  );
}

interface PatientTransmission {
  cxId: string;
  patientId: string;
  transmissionId: string;
}

async function getConsolidatedBundle(cxId: string, patientId: string): Promise<Bundle | undefined> {
  const s3Utils = new S3Utils("us-west-1");
  const fileKey = createConsolidatedDataFileNameWithSuffix(cxId, patientId) + ".json";
  if (!(await s3Utils.fileExists(medicalDocsBucketName, fileKey))) {
    return undefined;
  }
  const fileContent = await s3Utils.downloadFile({ bucket: medicalDocsBucketName, key: fileKey });
  return JSON.parse(fileContent.toString());
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
