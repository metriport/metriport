export type DocumentBulkDownloadDTO = {
  id: string;
  fileName: string;
  description?: string;
  status?: string;
  mimeType?: string;
  size?: number; // bytes
  signedUrl: string;
};
