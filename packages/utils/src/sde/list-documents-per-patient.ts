import { Command } from "commander";
import { listDocumentsPerPatient } from "@metriport/core/external/sde/command/document/list-document";
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
  bucketName,
}: {
  cxId: string;
  patientId: string;
  bucketName: string;
}) {
  console.log(`Listing documents per patient by CX ID: ${cxId} and patient ID: ${patientId}`);
  const documents = await listDocumentsPerPatient({ cxId, patientId, bucketName });
  console.log("Documents:", JSON.stringify(documents, null, 2));
}

export default command;
