import { Config } from "../../../util/config";
import { ProcessWriteToS3Handler } from "./write-to-s3";
import { ProcessWriteToS3Cloud } from "./write-to-s3-cloud";
import { ProcessWriteToS3Local } from "./write-to-s3-local";

export function buildWriteToS3Handler(): ProcessWriteToS3Handler {
  if (Config.isDev()) {
    return new ProcessWriteToS3Local();
  }
  const writeToS3QueueUrl = Config.getWriteToS3QueueUrl();
  return new ProcessWriteToS3Cloud(writeToS3QueueUrl);
}
