import { Command } from "commander";
import {
  saveExtractionSources,
  listLocalDocumentIds,
  getLocalDocument,
  listLocalPatientIds,
} from "./shared";
import { extractFromConversionBundle } from "@metriport/core/external/sde/extract";
// import { extractDocument } from "@metriport/core/external/sde/command/document/extract-document";

/**
 * Extracts all source text content from conversion bundles, and saves them locally per patient.
 *
 * Usage:
 * npm run sde -- extract-source --cx-id <cx-id>
 */
const command = new Command();
command.name("extract-source");
command.description("Extract all source text content from conversion bundles");
command.requiredOption("--cx-id <cx-id>", "The CX ID");
command.action(extractSources);

export async function extractSources({ cxId }: { cxId: string }) {
  console.log(`Extracting sources for customer ${cxId}`);
  const patientIds = listLocalPatientIds(cxId);
  let totalSources = 0;
  let totalPatients = 0;
  for (const patientId of patientIds) {
    totalSources += extractSourcesForPatient(cxId, patientId);
    totalPatients++;
    if (totalPatients % 100 === 0) {
      console.log(`Extracted ${totalSources} sources from ${totalPatients} patients`);
    }
  }
  console.log(`Extracted ${totalSources} sources from ${patientIds.length} patients`);
}

function extractSourcesForPatient(cxId: string, patientId: string): number {
  const documentIds = listLocalDocumentIds(cxId, patientId);
  let totalSources = 0;
  for (const documentId of documentIds) {
    const bundle = getLocalDocument(cxId, patientId, documentId);
    const sources = extractFromConversionBundle({ bundle, documentId });
    saveExtractionSources({ cxId, patientId, sources });
    totalSources += sources.length;
  }
  return totalSources;
}

export default command;
