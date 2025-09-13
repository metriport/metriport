#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import { Command } from "commander";
import { Bundle, Medication } from "@medplum/fhirtypes";
import { SurescriptsConvertPatientResponseHandlerDirect } from "@metriport/core/external/surescripts/command/convert-patient-response/convert-patient-response-direct";
import { SurescriptsReplica } from "@metriport/core/external/surescripts/replica";
import { createConsolidatedDataFileNameWithSuffix } from "@metriport/core/domain/consolidated/filename";
import { dangerouslyDeduplicateFhir } from "@metriport/core/fhir-deduplication/deduplicate-fhir";
import { getEnvVarOrFail } from "@metriport/shared";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { getTransmissionsFromCsv } from "./shared";
import { buildBundle } from "@metriport/core/external/fhir/bundle/bundle";

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
  .option("--out-file <outFile>", "The output file name within runs/surescripts")
  .action(
    async ({
      cxId,
      facilityId,
      csvData,
      outFile,
    }: {
      cxId: string;
      facilityId: string;
      csvData: string;
      resourceType: string;
      outFile?: string;
    }) => {
      if (!cxId) throw new Error("Customer ID is required");
      if (!facilityId) throw new Error("Facility ID is required");
      if (!csvData) throw new Error("CSV data is required");
      if (!outFile) {
        outFile = cxId + "_analysis.csv";
      }

      const replica = new SurescriptsReplica();
      const handler = new SurescriptsConvertPatientResponseHandlerDirect(replica);
      const transmissions = await getTransmissionsFromCsv(cxId, csvData);

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

        const newConsolidatedBundle = buildBundle({
          type: "collection",
          entries: [...(consolidatedBundle.entry ?? []), ...(conversion.bundle.entry ?? [])],
        });
        dangerouslyDeduplicateFhir(newConsolidatedBundle, cxId, patientId);

        // Compute the new number of entries and medications in the consolidated bundle
        dataPoint.newConsolidatedEntries = countEntries(newConsolidatedBundle);
        dataPoint.newConsolidatedMedications = countResourceType(
          newConsolidatedBundle,
          medicationResourceTypes
        );
        dataPoints.push(dataPoint as DataPoint);

        console.log(
          `CB(${dataPoint.consolidatedEntries}) + SS(${dataPoint.conversionEntries}) = CB'(${dataPoint.newConsolidatedEntries})`
        );
        const consolidatedMedications: Medication[] =
          consolidatedBundle.entry
            ?.filter(entry => entry.resource?.resourceType === "Medication")
            .map(entry => entry.resource as Medication) ?? [];
        const conversionMedications: Medication[] =
          conversion.bundle.entry
            ?.filter(entry => entry.resource?.resourceType === "Medication")
            .map(entry => entry.resource as Medication) ?? [];

        console.log(" --- consolidated vs conversion ---");
        console.log(
          twoColumnDisplay(
            JSON.stringify(consolidatedMedications, null, 2),
            JSON.stringify(conversionMedications, null, 2)
          )
        );
        console.log("--------------------------------");

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

      const runsDirectory = path.join(process.cwd(), "runs/surescripts/");
      if (!fs.existsSync(runsDirectory)) {
        fs.mkdirSync(runsDirectory, { recursive: true });
      }
      fs.writeFileSync(path.join(runsDirectory, outFile), csvContent);
    }
  );

function twoColumnDisplay(left: string, right: string, columnWidth = 80) {
  const leftLines = left.split("\n");
  const rightLines = right.split("\n");
  const maxLength = Math.max(leftLines.length, rightLines.length);
  const output: string[] = [];
  for (let i = 0; i < maxLength; i++) {
    output.push(
      `${(leftLines[i] ?? "").substring(0, columnWidth).padEnd(columnWidth)} ${(rightLines[i] ?? "")
        .substring(0, columnWidth)
        .padEnd(columnWidth)}`
    );
  }
  return output.join("\n");
}

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

export default program;
