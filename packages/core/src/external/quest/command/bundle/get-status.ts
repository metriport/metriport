import { Config } from "../../../../util/config";
import { S3Utils } from "../../../aws/s3";
import { buildPatientLabConversionPrefix } from "../../file/file-names";
import { SourceQueryProgress } from "../../../../domain/network-query";

export async function getPatientLabConversionStatus({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<SourceQueryProgress | undefined> {
  const s3 = new S3Utils(Config.getAWSRegion());
  const labBucketName = Config.getLabConversionBucketName();
  if (!labBucketName) {
    return undefined;
  }
  const files = await s3.listObjects(
    labBucketName,
    buildPatientLabConversionPrefix({ cxId, patientId })
  );

  return {
    type: "laboratory",
    source: "quest",
    status: "completed",
    documents: {
      downloadInProgress: 0,
      downloaded: files.length,
      converted: files.length,
      failed: 0,
      total: files.length,
    },
  };
}
