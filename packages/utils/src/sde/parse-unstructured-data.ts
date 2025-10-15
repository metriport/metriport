import { Command } from "commander";
import { downloadPatientDocument } from "@metriport/core/external/sde/command/document/download-patient-document";
import { parseUnstructuredDataFromBundle } from "@metriport/core/external/sde/command/bundle/parse-unstructured-data-from-bundle";

/**
 * List patients by CX ID
 * Usage:
 *
 * npm run sde -- parse-unstructured-data --cx-id <cx-id> --patient-id <patient-id> --document-id <document-id> --bucket-name <bucket-name>
 */
const command = new Command("parse-unstructured-data");
command.description("Parse unstructured data from a bundle");
command.requiredOption("--cx-id <cx-id>", "The CX ID");
command.requiredOption("--patient-id <patient-id>", "The patient ID");
command.requiredOption("--document-id <document-id>", "The document ID");
command.requiredOption("--bucket-name <bucket-name>", "The bucket name");
command.action(parseUnstructuredData);

export async function parseUnstructuredData({
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
  const document = await downloadPatientDocument({ cxId, patientId, documentId, bucketName });
  if (!document) {
    console.log("Document not found");
    return;
  }

  const unstructuredData = parseUnstructuredDataFromBundle({ documentId, bundle: document });
  console.log("Unstructured data:", JSON.stringify(unstructuredData, null, 2));
}

export default command;
