import { DocumentBulkSignerLambda } from "@metriport/core/external/aws/document-signing/document-bulk-signer-lambda";
import { DocumentBulkSignerLocal } from "@metriport/core/external/aws/document-signing//document-bulk-signer-local";
import { DocumentBulkSigner } from "@metriport/core/external/aws/document-signing//document-bulk-signer";
import { Config } from "@metriport/core/util/config";

const bulkSigningLambdaName = "BulkUrlSigningLambda";

export function makeDocumentBulkSigner(): DocumentBulkSigner {
  const region = Config.getAWSRegion();
  if (!Config.isCloudEnv()) {
    const bucketName = Config.getMedicalDocumentsBucketName();
    const apiURL = Config.getApiUrl();
    return new DocumentBulkSignerLocal(region, bucketName, apiURL);
  }
  return new DocumentBulkSignerLambda(region, bulkSigningLambdaName);
}
