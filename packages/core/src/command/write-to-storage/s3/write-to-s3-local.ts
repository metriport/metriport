import { S3Utils } from "../../../external/aws/s3";
import { Config } from "../../../util/config";
import { uuidv7 } from "../../../util/uuid-v7";
import { S3Writer, WriteToS3Request } from "./write-to-s3";

const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);

export class S3WriterLocal implements S3Writer {
  async writeToS3(params: WriteToS3Request): Promise<void> {
    const messagesByFilePath = params.reduce(
      (acc, param) => {
        const accKey = param.filePath;
        const accNew = acc[accKey] ?? { singleFiles: [], bulkFiles: [] };
        (param.fileName ? accNew.singleFiles : accNew.bulkFiles).push(param);
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
      Object.entries(messagesByFilePath).flatMap(([filePath, messagesMap]) => {
        const bulkBuckets = new Set(messagesMap.bulkFiles.map(f => f.bucket));
        if (bulkBuckets.size > 1) throw new Error("Bulk files must have the same bucket");
        return [
          ...messagesMap.singleFiles.map(f =>
            s3Utils.uploadFile({
              bucket: f.bucket,
              key: `${filePath}/${f.fileName}`,
              file: Buffer.from(f.payload),
              ...(f.contentType ? { contentType: f.contentType } : undefined),
              ...(f.metadata ? { metadata: f.metadata } : undefined),
            })
          ),
          ...(messagesMap.bulkFiles.length > 0
            ? [
                s3Utils.uploadFile({
                  bucket: bulkBuckets.values().next().value,
                  key: `${filePath}/${uuidv7()}.json`,
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
