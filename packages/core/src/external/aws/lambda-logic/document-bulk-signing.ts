import { S3Utils } from "../s3";
import { DocumentReference } from "@medplum/fhirtypes";

const SIGNED_URL_DURATION_SECONDS = 3600; // longer since a lot of docs

export type DocumentBulkSignerLambdaRequest = {
  patientId: string;
  cxId: string;
  documents: DocumentReference[];
};

export type DocumentBulkSignerLambdaResponse = {
  id: string;
  fileName: string;
  description?: string;
  status?: string;
  mimeType?: string;
  size?: number; // bytes
  signedUrl: string;
};

export async function getSignedUrls(
  documents: DocumentReference[],
  bucketName: string,
  region: string
): Promise<DocumentBulkSignerLambdaResponse[]> {
  const s3Utils = new S3Utils(region);

  const urls = await Promise.all(
    documents.map(async doc => {
      // Check if content and attachment exist
      if (!doc.content || !doc.content[0] || !doc.content[0].attachment) {
        return;
      }

      const attachment = doc.content[0].attachment;

      // Check if fileName is defined
      const fileName = attachment.title;
      if (!fileName) {
        return;
      }

      const signedUrl = await s3Utils.s3.getSignedUrl("getObject", {
        Bucket: bucketName,
        Key: fileName,
        Expires: SIGNED_URL_DURATION_SECONDS,
      });

      return {
        id: doc.id,
        fileName: fileName,
        description: doc.description,
        status: doc.status,
        mimeType: attachment.contentType,
        size: attachment.size,
        signedUrl: signedUrl,
      };
    })
  );

  return urls.filter(url => url !== undefined) as DocumentBulkSignerLambdaResponse[];
}
