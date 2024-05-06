import { createUploadMetadataFilePath } from "../domain/document/upload";
import { MetriportError } from "../util/error/metriport-error";
import { createAndUploadMetadataFile } from "./create-and-upload-extrinsic-object";
import { createUploadFilePath } from "../domain/document/upload";
import { uuidv7 } from "../util/uuid-v7";
import { S3Utils } from "../external/aws/s3";

const MAXIMUM_FILE_SIZE = 50_000_000; // 50 MB

export async function cdaDocumentUploaderHandler(
  cxId: string,
  patientId: string,
  document: string,
  destinationBucket: string,
  region: string
): Promise<void | { message: string; size: number }> {
  const s3Utils = new S3Utils(region);

  const docId = uuidv7();
  const metadataFileName = createUploadMetadataFilePath(cxId, patientId, docId);
  const destinationKey = createUploadFilePath(cxId, patientId, docId);

  console.log("destinationKey: ", destinationKey);

  // Make a copy of the file to the general medical documents bucket
  try {
    await s3Utils.uploadFile({
      bucket: destinationBucket,
      key: `${destinationKey}.xml`,
      file: Buffer.from(document),
    });
    console.log(
      `Successfully copied the uploaded file to ${destinationBucket} with key ${destinationKey}`
    );
  } catch (error) {
    const message = "Error copying the uploaded file to medical documents bucket";
    console.log(`${message}: ${error}`);
    throw new MetriportError(message, error, { destinationBucket, destinationKey });
  }

  try {
    const { size, eTag } = await s3Utils.getFileInfoFromS3(destinationKey, destinationBucket);
    const stringSize = size ? size.toString() : "";
    const hash = eTag ? eTag : "";
    await createAndUploadMetadataFile({
      s3Utils,
      cxId,
      patientId,
      docId: destinationKey,
      hash,
      size: stringSize,
      docRef: undefined,
      metadataFileName,
      destinationBucket,
      mimeType: "application/xml",
    });
    if (size && size > MAXIMUM_FILE_SIZE) {
      // #1207 TODO: Delete the file if it's too large and alert the customer.
      const message = `Uploaded file size exceeds the maximum allowed size`;
      console.log(`${message}: ${size}`);
      return { message, size };
    }
  } catch (error) {
    const message = "Failed with the call to create the metadata file of a CDA";
    console.log(`${message}: ${error}`);
    throw new MetriportError(message, error, { destinationBucket, destinationKey });
  }
}
