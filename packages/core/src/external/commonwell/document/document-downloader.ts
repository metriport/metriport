import { Capture } from "../../../util/capture";

export type DocumentDownloaderConfig = {
  region: string;
  bucketName: string;
  capture?: Capture;
};

export type Document = {
  id: string;
  mimeType?: string;
  location: string;
};

export type FileInfo = {
  name: string;
  location: string;
};

export type DownloadResult = {
  bucket: string;
  key: string;
  location: string;
  size: number | undefined;
  contentType: string | undefined;
};

export abstract class DocumentDownloader {
  constructor(readonly config: DocumentDownloaderConfig) {}

  abstract download({
    document,
    fileInfo,
    cxId,
    patientId,
  }: {
    document: Document;
    fileInfo: FileInfo;
    cxId: string;
    patientId: string;
  }): Promise<DownloadResult>;
}
