import { S3Utils } from "../../../external/aws/s3";
import { Config } from "../../../util/config";
import { uuidv7 } from "../../../util/uuid-v7";
import { ProcessWriteToS3Handler, ProcessWriteToS3Request } from "./write-to-s3";

const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);

export class ProcessWriteToS3Local implements ProcessWriteToS3Handler {
  async processWriteToS3(params: ProcessWriteToS3Request): Promise<void> {
    const { bucket, filePath, key, contentType, metadata, payload } = params;
    await s3Utils.uploadFile({
      bucket,
      key: `${filePath}/${key ?? `${uuidv7()}.json`}`,
      file: Buffer.from(payload),
      ...(contentType ? { contentType } : undefined),
      ...(metadata ? { metadata } : undefined),
    });
  }
}
