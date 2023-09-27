import { IndexFields } from ".";

export type IngestRequest = Omit<IndexFields, "content"> & {
  entryId: string;
  s3BucketName: string;
  requestId?: string | undefined;
};

export type OpenSearchFileIngestorConfig = {
  region: string;
  indexName: string;
};

export abstract class OpenSearchFileIngestor {
  constructor(readonly config: OpenSearchFileIngestorConfig) {}

  abstract ingest(req: IngestRequest): Promise<void>;

  isIngestible(file: { contentType?: string }) {
    const ingestibleTypes = ["xml", "text", "txt", "html", "htm", "ascii"];
    return ingestibleTypes.some(
      contentType => file.contentType && file.contentType.toLowerCase().includes(contentType)
    );
  }
}
