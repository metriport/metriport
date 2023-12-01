export type DocumentBulkUrlDTO = {
  id: string;
  fileName: string;
  description?: string;
  mimeType?: string;
  size?: number; // bytes
  signedUrl: string;
};
