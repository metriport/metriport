import AWS from "aws-sdk";
import path from "path";
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
    const documentIds =
      data.Contents?.map(item => {
        // TODO this looks wrong. No assigned empty string.
        const fileName = path.basename(item.Key || "");
        const documentId = path.parse(fileName).name;
        return documentId;
      }) || [];

    return documentIds;
  } catch (error) {
    console.error(`Error retrieving document IDs from S3: ${error}`);
    return undefined;
  }
}
