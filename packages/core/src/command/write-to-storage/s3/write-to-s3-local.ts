import { S3Utils } from "../../../external/aws/s3";
import { Config } from "../../../util/config";
import { uuidv7 } from "../../../util/uuid-v7";
import { S3Writer, WriteToS3Request } from "./write-to-s3";

const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);

export class S3WriterLocal implements S3Writer {
  async writeToS3(params: WriteToS3Request): Promise<void> {
    const { bucket, filePath, fileName, contentType, metadata, payload } = params;
    await s3Utils.uploadFile({
      bucket,
      key: `${filePath}/${fileName ?? `${uuidv7()}.json`}`,
      file: Buffer.from(payload),
      ...(contentType ? { contentType } : undefined),
      ...(metadata ? { metadata } : undefined),
    });
  }
}
