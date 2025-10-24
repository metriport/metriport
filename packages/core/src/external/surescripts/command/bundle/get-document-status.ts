import { Config } from "../../../../util/config";
import { S3Utils } from "../../../aws/s3";
import { buildPatientPharmacyConversionPrefix } from "../../file/file-names";
import { SourceQueryProgress } from "../../../../domain/network-query";

export async function getPatientPharmacyDocumentsStatus({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<SourceQueryProgress["documents"] | undefined> {
  const s3 = new S3Utils(Config.getAWSRegion());
  const pharmacyBucketName = Config.getPharmacyConversionBucketName();
  if (!pharmacyBucketName) {
    return undefined;
  }
  const files = await s3.listObjects(
    pharmacyBucketName,
    buildPatientPharmacyConversionPrefix(cxId, patientId)
  );

  return {
    downloadInProgress: 0,
    downloaded: files.length,
    converted: files.length,
    failed: 0,
    total: files.length,
  };
}
