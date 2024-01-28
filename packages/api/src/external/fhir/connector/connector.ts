export type FHIRServerRequest = {
  cxId: string;
  patientId: string;
  documentId: string;
  payload: string;
  requestId?: string;
};

export interface FHIRServerConnector {
  upsertBatch(req: FHIRServerRequest): Promise<void>;
}

// TODO try to make `requestId` required
export function makeJobId(requestId: string | undefined, documentId: string): string {
  return `${requestId}_${documentId}`;
}

export function decomposeJobId(
  jobId?: string
): { requestId?: string; documentId?: string } | undefined {
  if (!jobId) return undefined;
  const [requestId, documentId] = jobId.split("_");
  return { requestId, documentId };
}
