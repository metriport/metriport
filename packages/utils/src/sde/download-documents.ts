import { Command } from "commander";
import {
  downloadDocumentConversion,
  downloadAllDocumentConversions,
} from "@metriport/core/external/sde/command/document/download";
// import { extractDocument } from "@metriport/core/external/sde/command/document/extract-document";

/**
 * List patients by CX ID
 * Usage:
 *
 * npm run sde -- list-patients --cx-id <cx-id>
 */
const command = new Command();
command.name("download");
command.description("Download documents for a specific patient");

const downloadAll = new Command();
downloadAll.name("all");
downloadAll.description("Download all documents for a specific patient");
downloadAll.requiredOption("--cx-id <cx-id>", "The CX ID");
downloadAll.requiredOption("--patient-id <patient-id>", "The patient ID");
command.addCommand(downloadAll);

const downloadDocument = new Command();
downloadDocument.name("document");
downloadDocument.description("Download a specific document for a specific patient");
downloadDocument.requiredOption("--cx-id <cx-id>", "The CX ID");
downloadDocument.requiredOption("--patient-id <patient-id>", "The patient ID");
downloadDocument.requiredOption("--document-id <document-id>", "The document ID");
downloadDocument.action(downloadDocumentAction);

export async function downloadAllAction({ cxId, patientId }: { cxId: string; patientId: string }) {
  const documents = await downloadAllDocumentConversions({ cxId, patientId });
  console.log("Documents:", JSON.stringify(documents, null, 2));
}

export async function downloadDocumentAction({
  cxId,
  patientId,
  documentId,
}: {
  cxId: string;
  patientId: string;
  documentId: string;
}) {
  const document = await downloadDocumentConversion({ cxId, patientId, documentId });
  console.log("Document:", JSON.stringify(document, null, 2));
}

export default command;
