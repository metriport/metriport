import { errorToString } from "@metriport/shared";
import { S3Utils } from "../../../external/aws/s3";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { uuidv7 } from "../../../util/uuid-v7";
import { ProcessWriteToS3Handler, ProcessWriteToS3Request } from "./write-to-s3";

const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);

export class ProcessWriteToS3Local implements ProcessWriteToS3Handler {
  async processWriteToS3(params: ProcessWriteToS3Request): Promise<void> {
    const { serviceId, bucket, filePath, key, contentType, metadata, payload } = params;
    const { log } = out(
      `processWriteToS3.cloud - serviceId ${serviceId} destination ${`${bucket}/${key}`}`
    );
    const file = createFile(serviceId, payload);
    if (!file) return;
    try {
      await s3Utils.uploadFile({
        bucket,
        key: `${filePath}/${key ?? `${uuidv7()}.json`}`,
        file,
        ...(contentType ? { contentType } : undefined),
        ...(metadata ? { metadata } : undefined),
      });
    } catch (error) {
      const msg = `Failure while processing patient create @ PatientImport`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          serviceId,
          bucket,
          key,
          context: "write-to-s3-local.processWriteToS3",
          error,
        },
      });
      throw error;
    }
  }
}

export function createFile(serviceId: string, payload: string): Buffer | undefined {
  const { log } = out(`createFile.cloud - serviceId ${serviceId}`);
  try {
    return Buffer.from(payload);
  } catch (error) {
    const msg = `Failure while processing patient create @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        serviceId,
        context: "processWriteToS3Bulk.cloud",
        error,
      },
    });
    return undefined;
  }
}
