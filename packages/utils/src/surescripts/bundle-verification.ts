#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { SurescriptsConvertPatientResponseHandlerDirect } from "@metriport/core/external/surescripts/command/convert-patient-response/convert-patient-response-direct";
import { buildCsvPath, getConversionBundle, getTransmissionsFromCsv } from "./shared";
import { Bundle, BundleEntry, Medication, MedicationDispense } from "@medplum/fhirtypes";

const program = new Command();

program
  .name("bundle-verification")
  .description("verify customer bundles")
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

      const transmissions = await getTransmissionsFromCsv(cxId, csvData);

      let convertedCount = 0;
      const handler = new SurescriptsConvertPatientResponseHandlerDirect();
      for (const { patientId, transmissionId } of transmissions) {
        await handler.convertPatientResponse({
          cxId,
          facilityId,
          transmissionId,
          populationId: patientId,
        });

        const conversionBundle = await getConversionBundle(cxId, patientId);
        if (!conversionBundle) {
          console.log(`No conversion bundle generated for patient ${patientId}`);
          continue;
        }
        console.log(`✅ Conversion bundle successfully generated for patient ${patientId}`);
        verifyMedicationDispenseRefersToMedication(conversionBundle);

        convertedCount++;
        if (convertedCount % 100 === 0) {
          console.log(`Converted ${convertedCount} patients`);
        }
      }
      console.log(`Converted ${convertedCount} patients`);
    }
  );

function verifyMedicationDispenseRefersToMedication(bundle: Bundle): void {
  const medicationEntries =
    bundle.entry?.filter(entry => entry.resource?.resourceType === "Medication") ??
    ([] as BundleEntry<Medication>[]);
  const medicationDispenseEntries = bundle.entry?.filter(
    entry => entry.resource?.resourceType === "MedicationDispense"
  ) as BundleEntry<MedicationDispense>[];
  const medicationIdMap = new Map<string, Medication>(
    medicationEntries.map(medicationEntry => [
      "Medication/" + medicationEntry.resource?.id,
      medicationEntry.resource as Medication,
    ])
  );

  for (const medicationDispenseEntry of medicationDispenseEntries) {
    const medication = medicationDispenseEntry.resource?.medicationReference?.reference;

    if (!medication) {
      console.log(
        `❌ Medication dispense ${medicationDispenseEntry.fullUrl} does not refer to a medication.`
      );
    } else if (!medicationIdMap.has(medication)) {
      console.log(
        `❌ Medication dispense ${medicationDispenseEntry.resource?.id} refers to a medication that does not exist.`
      );
      console.log(`Medication: ${medication}`);
      console.log(`Medication ID map: ${Array.from(medicationIdMap.keys())}`);
    }
  }
}

export default program;
