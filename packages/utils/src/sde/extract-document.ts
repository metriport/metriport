import { Command } from "commander";
import { listDocumentIds } from "@metriport/core/external/sde/command/document/list-documents";
import { downloadDocumentConversion } from "@metriport/core/external/sde/command/document/download";
import { parseUnstructuredDataFromBundle } from "@metriport/core/external/sde/command/bundle/parse-bundle";
// import { extractDocument } from "@metriport/core/external/sde/command/document/extract-document";

/**
 * Extracts a document from S3
 * Usage:
 *
 * npm run sde -- extract-document --cx-id <cx-id> --patient-id <patient-id>
 */
const command = new Command("extract-document");
command.description("Extract a document from S3");
command.requiredOption("--cx-id <cx-id>", "The CX ID");
command.requiredOption("--patient-id <patient-id>", "The patient ID");
command.action(extractDocument);

export async function extractDocument({ cxId, patientId }: { cxId: string; patientId: string }) {
  console.log(`Listing documents per patient by CX ID: ${cxId} and patient ID: ${patientId}`);
  const documentIds = await listDocumentIds({ cxId, patientId });

  for (const documentId of documentIds) {
    console.log(`Extracting document from S3: ${documentId}`);
    const bundle = await downloadDocumentConversion({ cxId, patientId, documentId });
    if (!bundle) {
      console.log(`Document not found: ${documentId}`);
      continue;
    }

    const unstructuredData = parseUnstructuredDataFromBundle({
      documentId,
      bundle,
    });

    console.log("Unstructured data:", JSON.stringify(unstructuredData, null, 2));
  }
}

export default command;
