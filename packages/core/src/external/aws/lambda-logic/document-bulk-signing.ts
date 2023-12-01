import { S3Utils } from "../s3";
import { z } from "zod";
import { DocumentReference } from "@medplum/fhirtypes";
import { searchDocuments } from "../../opensearch/search-documents";
import axios from "axios";
import { capture } from "../../../util/notifications";
const ossApi = axios.create();

const SIGNED_URL_DURATION_SECONDS = 3000; // longer since a lot of docs

export type DocumentBulkSignerLambdaRequest = {
  patientId: string;
  cxId: string;
  requestId: string;
};

export type DocumentBulkSignerLambdaResponse = {
  id: string;
  fileName: string;
  description?: string;
  mimeType?: string;
  size?: number; // bytes
  signedUrl: string;
};

export async function getSignedUrls(
  cxId: string,
  patientId: string,
  requestId: string,
  bucketName: string,
  region: string,
  apiURL: string
) {
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
        mimeType: attachment.contentType,
        size: attachment.size,
        signedUrl: signedUrl,
      };
    })
  );

  const response = urls.filter(url => url !== undefined) as DocumentBulkSignerLambdaResponse[];
  const ossApiClient = apiClientBulkDownloadWebhook(apiURL);
  ossApiClient.triggerWebhook({
    cxId: cxId,
    patientId: patientId,
    requestId: requestId,
    dtos: response,
  });
  console.log("internal called");
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

export type BulkDownloadWebhookParams = {
  cxId: string;
  patientId: string;
  requestId: string;
  dtos: DocumentBulkSignerLambdaResponse[];
};

export function apiClientBulkDownloadWebhook(apiURL: string) {
  const sendBulkDownloadUrl = `${apiURL}/internal/docs/triggerBulkDownloadWebhook`;

  return {
    triggerWebhook: async function (params: BulkDownloadWebhookParams) {
      try {
        console.log(`Trigger API on ${sendBulkDownloadUrl} w/ ${JSON.stringify(params)}`);
        await ossApi.post(sendBulkDownloadUrl, params.dtos, {
          params: { cxId: params.cxId, patientId: params.patientId, requestId: params.requestId },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        const msg = "Error notifying API";
        const extra = {
          url: sendBulkDownloadUrl,
          statusCode: error.response?.status,
          error,
        };
        console.log(msg, extra);
        capture.message(msg, { extra, level: "info" });
        throw new Error(`Error from API: ${error.message}`);
      }
    },
  };
}
