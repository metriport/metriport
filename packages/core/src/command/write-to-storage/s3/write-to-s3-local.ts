import { S3Utils } from "../../../external/aws/s3";
import { Config } from "../../../util/config";
import { uuidv7 } from "../../../util/uuid-v7";
import { S3Writer, WriteToS3Request } from "./write-to-s3";

const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);

export class S3WriterLocal implements S3Writer {
  async writeToS3(params: WriteToS3Request): Promise<void> {
    const messagesByBucketAndFilePath = params.reduce(
      (acc, param) => {
        const accKey = createFileLookupKey(param);
        const accNew = acc[accKey] ?? { singleFiles: [], bulkFiles: [] };
        if (param.fileName) {
          accNew.singleFiles.push(param);
        } else {
          accNew.bulkFiles.push(param);
        }
        acc[accKey] = { ...accNew };
        return acc;
      },
      {} as Record<
        string,
        {
          singleFiles: WriteToS3Request;
          bulkFiles: WriteToS3Request;
        }
      >
    );
    await Promise.all(
      Object.entries(messagesByBucketAndFilePath).flatMap(([key, messagesMap]) => {
        const { bucket, filePath } = splitFileLookupKey(key);
        const filePathNoTrailingSlash = filePath.endsWith("/") ? filePath.slice(0, -1) : filePath;
        return [
          ...messagesMap.singleFiles.map(f =>
            s3Utils.uploadFile({
              bucket,
              key: `${filePathNoTrailingSlash}/${f.fileName}`,
              file: Buffer.from(f.payload),
              ...(f.contentType ? { contentType: f.contentType } : undefined),
              ...(f.metadata ? { metadata: f.metadata } : undefined),
            })
          ),
          ...(messagesMap.bulkFiles.length > 0
            ? [
                s3Utils.uploadFile({
                  bucket,
                  key: `${filePathNoTrailingSlash}/${uuidv7()}.json`,
                  file: Buffer.from(messagesMap.bulkFiles.map(m => m.payload).join("\n")),
                  contentType: "application/json",
                }),
              ]
            : []),
        ];
      })
    );
  }
}

const fileLookupKeySeparator = "_";

function createFileLookupKey(param: WriteToS3Request[number]): string {
  return `${param.bucket}${fileLookupKeySeparator}${param.filePath}`;
}

function splitFileLookupKey(key: string): { bucket: string; filePath: string } {
  const [bucket, ...filePathParts] = key.split(fileLookupKeySeparator);
  if (!bucket) throw new Error("Missing bucket");
  if (filePathParts.length < 1) throw new Error("Missing filePath");
  return { bucket, filePath: filePathParts.join(fileLookupKeySeparator) };
}
