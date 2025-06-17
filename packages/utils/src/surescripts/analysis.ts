#!/usr/bin/env node
import dotenv from "dotenv";
import csv from "csv-parser";
dotenv.config();

import fs from "fs";
import path from "path";

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

interface DataPoint {
  patientId: string;
  transmissionId: string;
  consolidatedEntries: number;
  consolidatedMedications: number;
  conversionEntries: number;
  conversionMedications: number;
  newConsolidatedEntries: number;
  newConsolidatedMedications: number;
}
const dataPoints: DataPoint[] = [];
const medicationResourceTypes = new Set(["Medication", "MedicationDispense", "MedicationRequest"]);

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
      resourceType: string;
    }) => {
      if (!cxId) throw new Error("Customer ID is required");
      if (!facilityId) throw new Error("Facility ID is required");
      if (!csvData) throw new Error("CSV data is required");

      const replica = new SurescriptsReplica();
      const handler = new SurescriptsConvertPatientResponseHandlerDirect(replica);
      let transmissions = await getTransmissionsFromCsv(cxId, csvData);
      transmissions = transmissions.slice(0, 1000);

      for (const { patientId, transmissionId } of transmissions) {
        // Compare existing consolidated to the conversion
        const [consolidatedBundle, conversion] = await Promise.all([
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

        if (!conversion || !conversion.bundle) {
          console.log(`No conversion bundle generated for patient ${patientId}`);
          continue;
        }

        const dataPoint: Partial<DataPoint> = {
          patientId,
          transmissionId,
        };
        // Compute the number of entries and medications in the current consolidated
        dangerouslyDeduplicateFhir(consolidatedBundle, cxId, patientId);
        dataPoint.consolidatedEntries = countEntries(consolidatedBundle);
        dataPoint.consolidatedMedications = countResourceType(
          consolidatedBundle,
          medicationResourceTypes
        );

        // Add the conversion bundle to the consolidated bundle and deduplicate
        dataPoint.conversionEntries = countEntries(conversion.bundle);
        dataPoint.conversionMedications = countResourceType(
          conversion.bundle,
          medicationResourceTypes
        );
        consolidatedBundle.entry?.push(...(conversion.bundle.entry ?? []));
        dangerouslyDeduplicateFhir(consolidatedBundle, cxId, patientId);

        // Compute the new number of entries and medications in the consolidated bundle
        dataPoint.newConsolidatedEntries = countEntries(consolidatedBundle);
        dataPoint.newConsolidatedMedications = countResourceType(
          consolidatedBundle,
          medicationResourceTypes
        );
        dataPoints.push(dataPoint as DataPoint);

        if (dataPoints.length % 100 === 0) {
          console.log(`Processed ${dataPoints.length} patients`);
        }
      }

      // Write the data points to a CSV file
      const csvContent =
        '"' +
        [
          "patient_id",
          "transmission_id",
          "consolidated_entries",
          "consolidated_medications",
          "conversion_entries",
          "conversion_medications",
          "new_consolidated_entries",
          "new_consolidated_medications",
        ].join('","') +
        '"\n' +
        dataPoints
          .map(dataPoint =>
            [
              `"${dataPoint.patientId}"`,
              `"${dataPoint.transmissionId}"`,
              dataPoint.consolidatedEntries,
              dataPoint.consolidatedMedications,
              dataPoint.conversionEntries,
              dataPoint.conversionMedications,
              dataPoint.newConsolidatedEntries,
              dataPoint.newConsolidatedMedications,
            ].join(",")
          )
          .join("\n");
      fs.writeFileSync(path.join(process.cwd(), "runs/surescripts/ccp_data.csv"), csvContent);
    }
  );

function countEntries(bundle: Bundle): number {
  return bundle.entry?.length ?? 0;
}

function countResourceType(bundle: Bundle, resourceTypes: Set<string>): number {
  return (
    bundle.entry?.filter(entry => resourceTypes.has(entry.resource?.resourceType ?? "")).length ?? 0
  );
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
