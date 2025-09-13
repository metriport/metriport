#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { SurescriptsConvertPatientResponseHandlerDirect } from "@metriport/core/external/surescripts/command/convert-patient-response/convert-patient-response-direct";
import {
  dangerouslyMergeBundles,
  getConsolidatedBundle,
  openPreviewUrl,
  writeConsolidatedBundlePreview,
} from "./shared";

const program = new Command();

interface ConvertResponseOptions {
  cxId?: string;
  facilityId?: string;
  transmissionId?: string;
  patientId?: string;
}

program
  .name("preview")
  .option("--cx-id <cxId>", "The customer ID")
  .option("--facility-id <facilityId>", "The facility ID")
  .option("--transmission-id <transmissionId>", "The transmission ID")
  .option("--patient-id <patientId>", "The patient ID")
  .description("Launch a preview window for a consolidated bundle")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async function ({ cxId, facilityId, transmissionId, patientId }: ConvertResponseOptions) {
    if (!cxId) throw new Error("Customer ID is required");
    if (!facilityId) throw new Error("Facility ID is required");
    if (!transmissionId) throw new Error("Transmission ID is required");
    if (!patientId) throw new Error("Patient ID is required");

    const handler = new SurescriptsConvertPatientResponseHandlerDirect();
    const start = Date.now();
    const conversion = await handler.convertPatientResponse({
      cxId,
      facilityId,
      transmissionId,
      populationId: patientId,
    });
    const end = Date.now();
    console.log(`Conversion took ${end - start} ms`);

    if (!conversion || !conversion.bundle) {
      console.error("No conversion bundle found");
      return;
    }

    const bundle = conversion.bundle;
    const consolidatedBundle = await getConsolidatedBundle(cxId, patientId);
    if (!consolidatedBundle) {
      console.error("No consolidated bundle found");
      return;
    }

    const mergedBundle = dangerouslyMergeBundles(cxId, patientId, consolidatedBundle, bundle);
    const previewUrl = await writeConsolidatedBundlePreview(cxId, patientId, mergedBundle);
    openPreviewUrl(previewUrl);
  });

export default program;
