#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";

import { Command } from "commander";
import { Bundle } from "@medplum/fhirtypes";
import { SurescriptsConvertBatchResponseHandlerDirect } from "@metriport/core/external/surescripts/command/convert-batch-response/convert-batch-response-direct";
import { SurescriptsReplica } from "@metriport/core/external/surescripts/replica";
import { dangerouslyDeduplicateFhir } from "@metriport/core/fhir-deduplication/deduplicate-fhir";
import { getConsolidatedBundle } from "./shared";
import { initRunsFolder, buildGetDirPathInside } from "../shared/folder";

const program = new Command();
initRunsFolder("surescripts");
const getDirPath = buildGetDirPathInside("surescripts");

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
  .description("analyze surescripts batch data for a customer")
  .option("--cx-id <cxId>", "The customer ID")
  .option("--facility-id <facilityId>", "The facility ID")
  .option("--org-name <orgName>", "The organization name")
  .option("--transmission-id <transmissionId>", "The batch transmission ID")
  .action(
    async ({
      cxId,
      facilityId,
      orgName,
      transmissionId,
    }: {
      cxId: string;
      facilityId: string;
      orgName?: string;
      transmissionId: string;
    }) => {
      if (!cxId) throw new Error("Customer ID is required");
      if (!facilityId) throw new Error("Facility ID is required");
      if (!transmissionId) throw new Error("Batch transmission ID is required");

      const replica = new SurescriptsReplica();
      const handler = new SurescriptsConvertBatchResponseHandlerDirect(replica);

      // First convert all patients in the batch into FHIR bundles that are uploaded to the
      // pharmacy conversion bucket.
      const conversionBundles = await handler.convertBatchResponse({
        cxId,
        facilityId,
        transmissionId,
        populationId: facilityId,
      });

      // Then, for each patient, we compare the existing consolidated bundle to the new conversion bundle
      for (const conversion of conversionBundles) {
        if (!conversion || !conversion.bundle) {
          console.log(`No conversion bundle generated for patient ${conversion.patientId}`);
          continue;
        }
        // Ensure the conversion bundle is deduplicated
        dangerouslyDeduplicateFhir(conversion.bundle, cxId, conversion.patientId);

        // Get consolidated bundle and ensure it is deduplicated
        const consolidated = await getConsolidatedBundle(cxId, conversion.patientId);
        if (!consolidated) {
          console.log(`No consolidated bundle found for patient ${conversion.patientId}`);
          continue;
        }
        dangerouslyDeduplicateFhir(consolidated, cxId, conversion.patientId);

        // Collect a data point about the consolidated vs conversion bundle
        const dataPoint: Partial<DataPoint> = {
          patientId: conversion.patientId,
          transmissionId,
        };
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
      const filePath = path.join(getDirPath(orgName ?? cxId), "analysis.csv");
      fs.writeFileSync(filePath, csvContent);
      console.log(`Wrote analysis to ${filePath}`);
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

export default program;
