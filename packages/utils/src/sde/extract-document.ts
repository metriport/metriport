import { Command } from "commander";
// import { extractDocument } from "@metriport/core/external/sde/command/document/extract-document";

/**
 * Extracts a document from S3
 * Usage:
 *
 * npm run sde -- extract-document --cx-id <cx-id> --patient-id <patient-id> --document-id <document-id>
 */
const command = new Command();
command.description("Extract a document from S3");
command.requiredOption("--cx-id <cx-id>", "The CX ID");
command.requiredOption("--patient-id <patient-id>", "The patient ID");
command.requiredOption("--document-id <document-id>", "The document ID");
command.action(extractDocument);

export async function extractDocument({
  cxId,
  patientId,
  documentId,
}: {
  cxId: string;
  patientId: string;
  documentId: string;
}) {
  console.log(`Extracting document ${documentId} from S3`);
  console.log(`CX ID: ${cxId}`);
  console.log(`Patient ID: ${patientId}`);
  console.log(`Document ID: ${documentId}`);
}

export default command;
