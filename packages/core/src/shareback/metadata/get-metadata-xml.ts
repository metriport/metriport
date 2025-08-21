import { UPLOADS_FOLDER } from "../../domain/document/upload";
import { createFolderName } from "../../domain/filename";
import { S3Utils, executeWithRetriesS3 } from "../../external/aws/s3";
import { XDSRegistryError } from "../../external/carequality/error";
import { Config } from "../../util/config";
import { capture } from "../../util/notifications";

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
  const folderName = createFolderName(cxId, patientId);
  const Prefix = `${folderName}/${UPLOADS_FOLDER}/`;

  const params = {
    Bucket: bucketName,
    Prefix,
  };

  const data = await executeWithRetriesS3(() => s3Utils._s3.listObjectsV2(params).promise());
  const documentContents = (
    await Promise.all(
      data.Contents?.filter(item => item.Key && item.Key.endsWith("_metadata.xml")).map(
        async item => {
          if (item.Key) {
            const params = {
              Bucket: bucketName,
              Key: item.Key,
            };

            const data = await executeWithRetriesS3(() => s3Utils._s3.getObject(params).promise());
            return data.Body?.toString();
          }
          return undefined;
        }
      ) || []
    )
  ).filter((item): item is string => Boolean(item));

  return documentContents;
}
