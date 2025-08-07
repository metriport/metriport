import { DocumentReference } from "@medplum/fhirtypes";
import { ingestIntoSearchEngine } from "@metriport/core/command/consolidated/search/document-reference/ingest";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";

export async function syncDocumentsToFhirAndOpenSearch({
  cxId,
  patientId,
  documents,
}: {
  cxId: string;
  patientId: string;
  documents: {
    s3Info: {
      key: string;
      bucket: string;
      contentType: string;
    };
    document: DocumentReference;
  }[];
}): Promise<void> {
  const failedDOcuments = [];
  const fhirApi = makeFhirApi(cxId);
  for (const { s3Info, document } of documents) {
    if (!document.id) {
      failedDOcuments.push(document);
      continue;
    }
    document.subject = {
      reference: `Patient/${patientId}`,
    };
    await fhirApi.createResource(document);
    await ingestIntoSearchEngine(
      { cxId, id: patientId },
      document.id,
      {
        key: s3Info.key,
        bucket: s3Info.bucket,
        contentType: s3Info.contentType,
      },
      "syncDocumentsToFhirAndOpenSearch",
      console.log
    );
  }
}
