import { Command } from "commander";

import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { downloadDocumentConversion } from "@metriport/core/sde/command/document/download";
import {
  loadPatientIds,
  saveConversionBundle,
  localPatientDirectoryExists,
  localPatientSourcesExist,
} from "./shared";
import { downloadAllDocumentConversions, saveExtractionSources } from "./shared";
import { ExtractionSource } from "@metriport/core/sde/types";
import { extractFromConversionBundle } from "@metriport/core/sde/extract";

/**
 * Utility script for downloading all documents for a specific customer.
 * Usage:
 *
 * npm run sde -- download customer --cx-id <cx-id>
 */
const command = new Command();
command.name("download");
command.description("Download documents for a specific patient");

const downloadCustomer = new Command();
downloadCustomer.name("customer");
downloadCustomer.description("Download all documents for a specific customer");
downloadCustomer.requiredOption("--cx-id <cx-id>", "The CX ID");
downloadCustomer.action(downloadCustomerAction);
command.addCommand(downloadCustomer);

async function downloadCustomerAction({ cxId }: { cxId: string }): Promise<void> {
  const patientIds = loadPatientIds(cxId);
  await executeAsynchronously(
    patientIds,
    async patientId => {
      if (
        localPatientDirectoryExists(cxId, patientId) ||
        localPatientSourcesExist(cxId, patientId)
      ) {
        console.log(`Patient ${patientId} already has downloaded documents`);
        return;
      }
      const documentConversions = await downloadAllDocumentConversions({ cxId, patientId });
      const allSources: ExtractionSource[] = [];
      for (const { bundle, documentId } of documentConversions) {
        const sources = extractFromConversionBundle({
          bundle,
          documentId,
        });
        allSources.push(...sources);
      }
      if (allSources.length > 0) {
        saveExtractionSources({ cxId, patientId, sources: allSources });
        console.log(`Downloaded ${documentConversions.length} documents for patient ${patientId}`);
        console.log(`Extracted ${allSources.length} sources for patient ${patientId}`);
      }
    },
    { numberOfParallelExecutions: 10 }
  );
}

/**
 * Utility script for downloading all documents for a specific patient.
 * Usage:
 *
 * npm run sde -- download patient --cx-id <cx-id> --patient-id <patient-id>
 */
const downloadPatient = new Command();
downloadPatient.name("patient");
downloadPatient.description("Download all documents for a specific patient");
downloadPatient.requiredOption("--cx-id <cx-id>", "The CX ID");
downloadPatient.requiredOption("--patient-id <patient-id>", "The patient ID");
downloadPatient.action(downloadPatientAction);
command.addCommand(downloadPatient);

async function downloadPatientAction({ cxId, patientId }: { cxId: string; patientId: string }) {
  const documentConversions = await downloadAllDocumentConversions({ cxId, patientId });
  const allSources: ExtractionSource[] = [];
  for (const { bundle, documentId } of documentConversions) {
    const sources = extractFromConversionBundle({
      bundle,
      documentId,
    });
    allSources.push(...sources);
  }
  saveExtractionSources({ cxId, patientId, sources: allSources });
  console.log(`Downloaded ${documentConversions.length} documents for patient ${patientId}`);
  console.log(`Extracted ${allSources.length} sources for patient ${patientId}`);
}

/**
 * Utility script for downloading a specific document for a specific patient.
 * Usage:
 *
 * npm run sde -- download document --cx-id <cx-id> --patient-id <patient-id> --document-id <document-id>
 */
const downloadDocument = new Command();
downloadDocument.name("document");
downloadDocument.description("Download a specific document for a specific patient");
downloadDocument.requiredOption("--cx-id <cx-id>", "The CX ID");
downloadDocument.requiredOption("--patient-id <patient-id>", "The patient ID");
downloadDocument.requiredOption("--document-id <document-id>", "The document ID");
downloadDocument.action(downloadDocumentAction);
command.addCommand(downloadDocument);

export async function downloadDocumentAction({
  cxId,
  patientId,
  documentId,
}: {
  cxId: string;
  patientId: string;
  documentId: string;
}) {
  const bundle = await downloadDocumentConversion({ cxId, patientId, documentId });
  if (bundle) {
    saveConversionBundle({ cxId, patientId, documentId, bundle });
  }
}

export default command;
