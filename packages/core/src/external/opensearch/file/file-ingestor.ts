import { OpenSearchConfig } from "..";
import { IndexFields } from "../index-based-on-file";

export type IngestRequest = Omit<IndexFields, "content"> & {
  entryId: string;
  s3BucketName: string;
  requestId?: string | undefined;
};

export type OpenSearchFileIngestorConfig = OpenSearchConfig;

export abstract class OpenSearchFileIngestor {
  constructor(readonly config: OpenSearchFileIngestorConfig) {}

  abstract ingest(req: IngestRequest): Promise<void>;

  isIngestible(file: { contentType?: string | undefined; fileName: string }) {
    const ingestibleTypes = ["xml", "text", "txt", "html", "htm", "ascii"];
    if (file.contentType) {
      return ingestibleTypes.some(
        contentType => file.contentType && file.contentType.toLowerCase().includes(contentType)
      );
    }
    return ingestibleTypes.some(contentType =>
      file.fileName.toLowerCase().endsWith(`.${contentType}`)
    );
  }
}
