import { Command } from "commander";
import { listDocumentsPerPatient } from "@metriport/core/external/sde/command/document/list-documents-per-patient";
import { downloadPatientDocument } from "@metriport/core/external/sde/command/document/download-patient-document";
import { parseUnstructuredDataFromBundle } from "@metriport/core/external/sde/command/bundle/parse-unstructured-data-from-bundle";
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
command.requiredOption("--bucket-name <bucket-name>", "The bucket name");
command.action(extractDocument);

export async function extractDocument({
  cxId,
  patientId,
  bucketName,
}: {
  cxId: string;
  patientId: string;
  bucketName: string;
}) {
  console.log(`Listing documents per patient by CX ID: ${cxId} and patient ID: ${patientId}`);
  const patientWithDocuments = await listDocumentsPerPatient({ cxId, patientId, bucketName });

  for (const doc of patientWithDocuments.documents) {
    console.log(`Extracting document from S3: ${doc.key}`);
    const bundle = await downloadPatientDocument({
      cxId,
      patientId,
      documentId: doc.key,
      bucketName,
    });

    if (!bundle) {
      console.log(`Document not found: ${doc.key}`);
      continue;
    }

    const unstructuredData = parseUnstructuredDataFromBundle({
      documentId: doc.key,
      bundle,
    });

    console.log("Unstructured data:", JSON.stringify(unstructuredData, null, 2));
  }
}

export default command;
