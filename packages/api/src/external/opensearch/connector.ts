export type IngestRequest = {
  cxId: string;
  patientId: string;
  s3FileName: string;
  s3BucketName: string;
  requestId?: string;
};

export interface SearchConnector {
  ingest(req: IngestRequest): Promise<void>;
  // TODO 1050: implement search
  // search(req: SearchRequest): Promise<void>;
}
