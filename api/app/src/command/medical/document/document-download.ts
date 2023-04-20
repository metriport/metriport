import * as AWS from "aws-sdk";
import { Config } from "../../../shared/config";

const s3client = new AWS.S3();

export const downloadDocument = async ({ fileName }: { fileName: string }): Promise<string> => {
  const seconds = 60;

  const url = s3client.getSignedUrl("getObject", {
    Bucket: Config.getMedicalDocumentsBucketName(),
    Key: fileName,
    Expires: seconds,
  });

  return url;
};
