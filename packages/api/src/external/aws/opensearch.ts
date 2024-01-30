import { errorToString } from "@metriport/core/util/error/index";
import { capture } from "@metriport/core/util/notifications";
import { Patient } from "@metriport/core/domain/patient";
import { DocumentReferenceWithId } from "../fhir/document";
import { makeSearchServiceIngest } from "../opensearch/file-search-connector-factory";

export async function ingestIntoSearchEngine(
  patient: Pick<Patient, "id" | "cxId">,
  fhirDoc: DocumentReferenceWithId,
  file: {
    key: string;
    bucket: string;
    contentType: string | undefined;
  },
  requestId: string,
  log = console.log
): Promise<void> {
  const openSearch = makeSearchServiceIngest();
  if (!openSearch.isIngestible({ contentType: file.contentType, fileName: file.key })) {
    log(
      `Skipping ingestion of doc ${fhirDoc.id} / file ${file.key} into OpenSearch: not ingestible`
    );
    return;
  }
  try {
    await openSearch.ingest({
      cxId: patient.cxId,
      patientId: patient.id,
      entryId: fhirDoc.id,
      s3FileName: file.key,
      s3BucketName: file.bucket,
      requestId,
    });
  } catch (error) {
    const msg = `Error ingesting doc into OpenSearch`;
    log(`${msg}. Document ID: ${fhirDoc.id}, file key: ${file.key}: ${errorToString(error)}`);
    capture.message(msg, {
      extra: {
        context: `ingestIntoSearchEngine`,
        patientId: patient.id,
        file,
        requestId,
        error,
      },
      level: "error",
    });
    // intentionally not throwing here, we don't want to fail b/c of search ingestion
  }
}
