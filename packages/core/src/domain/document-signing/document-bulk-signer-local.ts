import { signUrlsAndSendToApi } from "./bulk-sign";
import { DocumentBulkSigner, DocumentBulkSignerRequest } from "./document-bulk-signer";

export class DocumentBulkSignerLocal extends DocumentBulkSigner {
  constructor(region: string, readonly bucketName: string, readonly apiURL: string) {
    super(region);
  }

  async sign({ patientId, cxId, requestId }: DocumentBulkSignerRequest): Promise<void> {
    await signUrlsAndSendToApi(
      cxId,
      patientId,
      requestId,
      this.bucketName,
      this.region,
      this.apiURL
    );
  }
}
