import { Command } from "commander";
import {
  getConsolidatedBundle,
  openPreviewUrl,
  writeConsolidatedBundlePreview,
} from "../surescripts/shared";

/**
 * Runs structured data extraction on a patient, and displays a preview of the generated bundle.
 */
const command = new Command();
command.name("preview-patient");
command.requiredOption("--cx-id <cxId>", "The customer ID");
command.requiredOption("--patient-id <ptId>", "The patient ID");
command.description("Preview a patient's consolidated bundle after running data extraction");
command.showHelpAfterError();

command.action(previewPatient);

async function previewPatient({ cxId, ptId }: { cxId: string; ptId: string }) {
  const bundle = await getConsolidatedBundle(cxId, ptId);
  if (!bundle) {
    throw new Error(`Bundle not found for patient ${ptId}`);
  }

  const previewUrl = await writeConsolidatedBundlePreview(cxId, ptId, bundle);
  openPreviewUrl(previewUrl);
}
