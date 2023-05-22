import { makeS3Client } from "../../../external/aws/s3";
import { Config } from "../../../shared/config";

const s3client = makeS3Client();

export const downloadDocument = async ({ fileName }: { fileName: string }): Promise<string> => {
  const seconds = 60;

  const url = s3client.getSignedUrl("getObject", {
    Bucket: Config.getMedicalDocumentsBucketName(),
    Key: fileName,
    Expires: seconds,
  });

  return url;
};
