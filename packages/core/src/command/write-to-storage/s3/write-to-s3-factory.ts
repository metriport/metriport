import { Config } from "../../../util/config";
import { S3Writer } from "./write-to-s3";
import { S3WriterCloud } from "./write-to-s3-cloud";
import { S3WriterLocal } from "./write-to-s3-local";

export function buildWS3WriterHandler(): S3Writer {
  if (Config.isDev()) return new S3WriterLocal();
  const writeToS3QueueUrl = Config.getWriteToS3QueueUrl();
  return new S3WriterCloud(writeToS3QueueUrl);
}
