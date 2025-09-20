import { S3Utils } from "../../external/aws/s3";
import { XDSRegistryError } from "../../external/carequality/error";
import { Config } from "../../util/config";
import { capture } from "../../util/notifications";
import { createSharebackFolderName, METADATA_SUFFIX } from "../file";

const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);
const bucket = Config.getMedicalDocumentsBucketName();

export async function getMetadataDocumentContents(
  cxId: string,
  patientId: string
): Promise<string[]> {
  const documentContents = await retrieveXmlContentsFromMetadataFilesOnS3(cxId, patientId, bucket);

  if (!documentContents.length) {
    const msg = `Missing CCD metadata file for patient`;
    capture.error(msg, { extra: { cxId, patientId } });
    throw new XDSRegistryError("Internal Server Error");
  }
  return documentContents;
}

async function retrieveXmlContentsFromMetadataFilesOnS3(
  cxId: string,
  patientId: string,
  bucketName: string
): Promise<string[]> {
  const prefix = createSharebackFolderName({ cxId, patientId });

  const data = await s3Utils.listObjects(bucketName, prefix);
  const documentContents = (
    await Promise.all(
      data
        .filter(item => item.Key && item.Key.endsWith(METADATA_SUFFIX))
        .map(async item => {
          const key = item.Key;
          if (key) return await s3Utils.getFileContentsAsString(bucketName, key);
          return undefined;
        }) || []
    )
  ).filter((item): item is string => Boolean(item));

  return documentContents;
}
