import { Command } from "commander";
import { listDocumentIds } from "@metriport/core/external/sde/command/document/list-documents";
// import { extractDocument } from "@metriport/core/external/sde/command/document/extract-document";

/**
 * List patients by CX ID
 * Usage:
 *
 * npm run sde -- list-patients --cx-id <cx-id>
 */
const command = new Command("list-documents-per-patient");
command.description("List documents per patient");
command.requiredOption("--cx-id <cx-id>", "The CX ID");
command.requiredOption("--patient-id <patient-id>", "The patient ID");
command.requiredOption("--bucket-name <bucket-name>", "The bucket name");
command.action(listDocuments);

export async function listDocuments({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
  bucketName: string;
}) {
  console.log(`Listing documents per patient by CX ID: ${cxId} and patient ID: ${patientId}`);
  const documentIds = await listDocumentIds({ cxId, patientId });
  console.log("Document IDs:", documentIds);
}

export default command;
