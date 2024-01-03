import AWS from "aws-sdk";
import { getEnvVarOrFail } from "../../../util/env-var";
const s3 = new AWS.S3();

const bucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
export async function retrieveDocumentIdsFromS3(
  cxId: string,
  patientId: string
): Promise<string[] | undefined> {
  const Prefix = `${cxId}/${patientId}/uploads/`;

  const params = {
    Bucket: bucketName,
    Prefix,
  };

  try {
    const data = await s3.listObjectsV2(params).promise();
    const documentContents = (
      await Promise.all(
        data.Contents?.filter(item => item.Key && item.Key.endsWith("_metadata.xml")).map(
          async item => {
            if (item.Key) {
              const params = {
                Bucket: bucketName,
                Key: item.Key,
              };

              const data = await s3.getObject(params).promise();
              return data.Body?.toString();
            }
            return undefined;
          }
        ) || []
      )
    ).filter((item): item is string => Boolean(item));

    return documentContents;
  } catch (error) {
    console.error(`Error retrieving document IDs from S3: ${error}`);
    return undefined;
  }
}
