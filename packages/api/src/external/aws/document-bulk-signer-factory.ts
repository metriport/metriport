import { DocumentBulkSignerLambda } from "@metriport/core/domain/document-signing/document-bulk-signer-lambda";
import { DocumentBulkSignerLocal } from "@metriport/core/domain/document-signing/document-bulk-signer-local";
import { DocumentBulkSigner } from "@metriport/core/domain/document-signing/document-bulk-signer";
import { Config } from "../../shared/config";

const bulkSigningLambdaName = Config.getDocumentSignerLambdaName();

export function makeDocumentBulkSigner(): DocumentBulkSigner {
  const region = Config.getAWSRegion();
  if (Config.isDev()) {
    const bucketName = Config.getMedicalDocumentsBucketName();
    const apiURL = Config.getApiUrl();
    return new DocumentBulkSignerLocal(region, bucketName, apiURL);
  }
  return new DocumentBulkSignerLambda(region, bulkSigningLambdaName);
}
