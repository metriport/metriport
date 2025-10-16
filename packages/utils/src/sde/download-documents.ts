import { Command } from "commander";
import { downloadDocumentConversion } from "@metriport/core/external/sde/command/document/download";
// import { extractDocument } from "@metriport/core/external/sde/command/document/extract-document";

/**
 * List patients by CX ID
 * Usage:
 *
 * npm run sde -- list-patients --cx-id <cx-id>
 */
const command = new Command("download-documents");
command.description("Download a document for a patient");
command.requiredOption("--cx-id <cx-id>", "The CX ID");
command.requiredOption("--patient-id <patient-id>", "The patient ID");
command.requiredOption("--document-id <document-id>", "The document ID");
command.action(downloadDocument);

export async function downloadDocument({
  cxId,
  patientId,
  documentId,
  bucketName,
}: {
  cxId: string;
  patientId: string;
  documentId: string;
  bucketName: string;
}) {
  console.log(`Downloading document for patient by CX ID: ${cxId} and patient ID: ${patientId}`);
  console.log(`Document ID: ${documentId}`);
  console.log(`Bucket name: ${bucketName}`);
  const document = await downloadDocumentConversion({ cxId, patientId, documentId });
  console.log("Document:", JSON.stringify(document, null, 2));
}

export default command;
