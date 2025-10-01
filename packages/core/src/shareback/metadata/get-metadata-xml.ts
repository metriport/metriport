import { executeWithRetries } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { executeWithRetriesS3, S3Utils } from "../../external/aws/s3";
import { XDSRegistryError } from "../../external/carequality/error";
import { Config } from "../../util/config";
import { out } from "../../util/log";
import { capture } from "../../util/notifications";
import { createSharebackFolderName, METADATA_SUFFIX } from "../file";

dayjs.extend(duration);

const maxAttempts = 8;
const initialTimeToWaitBetweenAttempts = dayjs.duration(100, "milliseconds");
const maxTimeToWaitBetweenAttempts = dayjs.duration(5, "seconds");

const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);
const bucket = Config.getMedicalDocumentsBucketName();

export async function getMetadataDocumentContents(
  cxId: string,
  patientId: string
): Promise<string[]> {
  const { log } = out(`getMetadataDocumentContents - cxId ${cxId}, patientId ${patientId}`);
  const alreadyLoadedFiles: { key: string; contents: string }[] = [];

  await executeWithRetries(
    async () => {
      const filesOfIteration = await retrieveXmlContentsFromMetadataFilesOnS3(
        cxId,
        patientId,
        bucket,
        alreadyLoadedFiles
      );
      alreadyLoadedFiles.push(...filesOfIteration);
    },
    {
      shouldRetry: async () => {
        const containsCcdMetadataFile = alreadyLoadedFiles.some(item =>
          item.key.endsWith(METADATA_SUFFIX)
        );
        if (containsCcdMetadataFile) return false;
        return true;
      },
      initialDelay: initialTimeToWaitBetweenAttempts.asMilliseconds(),
      maxDelay: maxTimeToWaitBetweenAttempts.asMilliseconds(),
      maxAttempts,
      log,
    }
  );

  if (!alreadyLoadedFiles.length) {
    const msg = `Missing CCD metadata file for patient`;
    capture.error(msg, { extra: { cxId, patientId } });
    throw new XDSRegistryError("Internal Server Error");
  }
  return alreadyLoadedFiles.map(item => item.contents);
}

async function retrieveXmlContentsFromMetadataFilesOnS3(
  cxId: string,
  patientId: string,
  bucketName: string,
  alreadyLoadedFiles: { key: string; contents: string }[]
): Promise<{ key: string; contents: string }[]> {
  const prefix = createSharebackFolderName({ cxId, patientId });

  const data = await executeWithRetriesS3(() => s3Utils.listObjects(bucketName, prefix));
  const keysAndMetaContents = (
    await Promise.all(
      data
        .filter(item => item.Key && item.Key.endsWith(METADATA_SUFFIX))
        .map(async item => {
          const key = item.Key;
          if (key && !alreadyLoadedFiles.some(item => item.key === key)) {
            const data = await executeWithRetriesS3(() =>
              s3Utils.getFileContentsAsString(bucketName, key)
            );
            return { key, contents: data };
          }
          return undefined;
        }) || []
    )
  ).filter((item): item is { key: string; contents: string } => Boolean(item));

  return keysAndMetaContents;
}
