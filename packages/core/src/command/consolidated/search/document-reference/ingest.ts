import { Patient } from "../../../../domain/patient";
import { errorToString } from "../../../../util/error/shared";
import { out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
import { makeSearchServiceIngest } from "../../../../external/opensearch/file/file-search-connector-factory";

export async function ingestIntoSearchEngine(
  patient: Pick<Patient, "id" | "cxId">,
  entryId: string,
  file: {
    key: string;
    bucket: string;
    contentType: string | undefined;
  },
  requestId: string,
  log = out(`ingestIntoSearchEngine`).log
): Promise<void> {
  const openSearch = makeSearchServiceIngest();
  if (!openSearch.isIngestible({ contentType: file.contentType, fileName: file.key })) {
    log(
      `Skipping ingestion of entry ${entryId} / file ${file.key} into OpenSearch: not ingestible`
    );
    return;
  }
  try {
    await openSearch.ingest({
      cxId: patient.cxId,
      patientId: patient.id,
      entryId: entryId,
      s3FileName: file.key,
      s3BucketName: file.bucket,
      requestId,
    });
  } catch (error) {
    const msg = `Error ingesting file into OpenSearch`;
    log(`${msg}. Entry ID: ${entryId}, file key: ${file.key}: ${errorToString(error)}`);
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
