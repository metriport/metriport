import _ from "lodash";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { S3Utils } from "../../../aws/s3";
import { getCdaToFhirConversionPrefix } from "../../file-names";

const documentKeyFilter = ".xml.json";

export async function listDocuments({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<string[]> {
  const { log } = out(`sde.listDocuments - cx ${cxId}, pat ${patientId}`);
  log("Listing documents...");
  const s3 = new S3Utils(Config.getAWSRegion());
  const bucketName = Config.getCdaToFhirConversionBucketName();
  if (!bucketName) {
    log(`No cda to fhir conversion bucket name found, skipping`);
    return [];
  }

  const documents = await s3.listObjects(
    bucketName,
    getCdaToFhirConversionPrefix({ cxId, patientId })
  );
  const allDocumentKeys = _(documents.map(document => document.Key))
    .compact()
    .value();
  const bundleDocumentKeys = allDocumentKeys.filter(key => key.endsWith(documentKeyFilter));
  log(`Found ${bundleDocumentKeys.length} documents`);
  return bundleDocumentKeys;
}
