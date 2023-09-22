export type IngestRequest = {
  cxId: string;
  patientId: string;
  s3FileName: string;
  s3BucketName: string;
  requestId?: string;
};

export abstract class FileSearchConnector {
  abstract ingest(req: IngestRequest): Promise<void>;

  // TODO 1050: implement search
  // search(req: SearchRequest): Promise<void>;

  isIngestible(file: { contentType?: string }) {
    const ingestibleTypes = ["xml", "text", "txt", "html", "htm"];
    return ingestibleTypes.some(
      contentType => file.contentType && file.contentType.toLowerCase().includes(contentType)
    );
  }
}
