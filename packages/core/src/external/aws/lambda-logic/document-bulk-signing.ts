import { S3Utils } from "../s3";
import { z } from "zod";
import { DocumentReference } from "@medplum/fhirtypes";
import { searchDocuments } from "@metriport/core/src/external/opensearch/search-documents";

const SIGNED_URL_DURATION_SECONDS = 3600; // longer since a lot of docs

export type DocumentBulkSignerLambdaRequest = {
  patientId: string;
  cxId: string;
  requestId: string;
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
  cxId: string,
  patientId: string,
  bucketName: string,
  region: string
): Promise<DocumentBulkSignerLambdaResponse[]> {
  const s3Utils = new S3Utils(region);

  const documents: DocumentReference[] = await searchDocuments({ cxId, patientId });

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

      const signedUrl = await s3Utils.getSignedUrl({
        bucketName,
        fileName,
        durationSeconds: SIGNED_URL_DURATION_SECONDS,
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

export const DocumentBulkSignerLambdaResponseSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  description: z.string().optional(),
  status: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().optional(),
  signedUrl: z.string(),
});

export const DocumentBulkSignerLambdaResponseArraySchema = z.array(
  DocumentBulkSignerLambdaResponseSchema
);
