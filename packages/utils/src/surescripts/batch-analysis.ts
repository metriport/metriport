#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";

import { Command } from "commander";
import { Bundle } from "@medplum/fhirtypes";
import { SurescriptsConvertBatchResponseHandlerDirect } from "@metriport/core/external/surescripts/command/convert-batch-response/convert-batch-response-direct";
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
  .name("batch-analysis")
  .description("analyze surescripts data for a customer")
  .option("--cx-id <cxId>", "The customer ID")
  .option("--facility-id <facilityId>", "The facility ID")
  .option("--transmission-id <transmissionId>", "The batch transmission ID")
  .action(
    async ({
      cxId,
      facilityId,
      transmissionId,
    }: {
      cxId: string;
      facilityId: string;
      transmissionId: string;
    }) => {
      if (!cxId) throw new Error("Customer ID is required");
      if (!facilityId) throw new Error("Facility ID is required");
      if (!transmissionId) throw new Error("Batch transmission ID is required");

      const replica = new SurescriptsReplica();
      const handler = new SurescriptsConvertBatchResponseHandlerDirect(replica);

      const conversionBundles = await handler.convertBatchResponse({
        cxId,
        facilityId,
        transmissionId,
        populationId: facilityId,
      });

      for (const conversion of conversionBundles) {
        if (!conversion || !conversion.bundle) {
          console.log(`No conversion bundle generated for patient ${conversion.patientId}`);
          continue;
        }

        // Compare existing consolidated to the conversion
        const consolidated = await getConsolidatedBundle(cxId, conversion.patientId);

        if (!consolidated) {
          console.log(`No consolidated bundle found for patient ${conversion.patientId}`);
          continue;
        }

        const dataPoint: Partial<DataPoint> = {
          patientId: conversion.patientId,
          transmissionId,
        };
        // Compute the number of entries and medications in the current consolidated
        dangerouslyDeduplicateFhir(consolidated, cxId, conversion.patientId);
        dataPoint.consolidatedEntries = countEntries(consolidated);
        dataPoint.consolidatedMedications = countResourceType(
          consolidated,
          medicationResourceTypes
        );

        // Add the conversion bundle to the consolidated bundle and deduplicate
        dataPoint.conversionEntries = countEntries(conversion.bundle);
        dataPoint.conversionMedications = countResourceType(
          conversion.bundle,
          medicationResourceTypes
        );
        consolidated.entry?.push(...(conversion.bundle.entry ?? []));
        dangerouslyDeduplicateFhir(consolidated, cxId, conversion.patientId);

        // Compute the new number of entries and medications in the consolidated bundle
        dataPoint.newConsolidatedEntries = countEntries(consolidated);
        dataPoint.newConsolidatedMedications = countResourceType(
          consolidated,
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
      fs.writeFileSync(path.join(process.cwd(), "runs/surescripts/1to1_data.csv"), csvContent);
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

export default program;
