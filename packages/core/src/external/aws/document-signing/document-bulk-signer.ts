export type DocumentBulkSignerRequest = {
  patientId: string;
  cxId: string;
  requestId: string;
};

export abstract class DocumentBulkSigner {
  constructor(readonly region: string) {}
  abstract sign({ patientId, cxId, requestId }: DocumentBulkSignerRequest): Promise<void>;
}
