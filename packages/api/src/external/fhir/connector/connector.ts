export type FHIRServerRequest = {
  cxId: string;
  patientId: string;
  documentId: string;
  payload: string;
};

export interface FHIRServerConnector {
  upsertBatch(req: FHIRServerRequest): Promise<void>;
}
