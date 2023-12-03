import { S3Utils } from "../s3";
import { z } from "zod";
import { DocumentReference } from "@medplum/fhirtypes";
import { searchDocuments } from "../../opensearch/search-documents";
import axios from "axios";
import { capture } from "../../../util/notifications";
import { getEnvVarOrFail } from "../../../util/env-var";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
const ossApi = axios.create();
dayjs.extend(duration);

const SIGNED_URL_DURATION_SECONDS = dayjs.duration({ minutes: 3 }).asSeconds();

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
  url: string;
};

export async function getSignedUrls(
  cxId: string,
  patientId: string,
  requestId: string,
  bucketName: string,
  region: string,
  apiURL: string
) {
  console.log(`DEBUGGING: fhir_server: ${getEnvVarOrFail("FHIR_SERVER_URL")}`);
  //`search_endpoint: ${getEnvVarOrFail("SEARCH_ENDPOINT")}, search_index: ${getEnvVarOrFail("SEARCH_INDEX")}, search_username: ${getEnvVarOrFail("SEARCH_USERNAME")}, search_password: ${getEnvVarOrFail("PASSWORD")} `);
  const s3Utils = new S3Utils(region);

  const documents: DocumentReference[] = await searchDocuments({ cxId, patientId });

  console.log(`Found ${documents}`);

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
        url: signedUrl,
      };
    })
  );

  const response = urls.filter(url => url !== undefined) as DocumentBulkSignerLambdaResponse[];

  console.log(`Signed URLs: ${JSON.stringify(response)}`);
  const ossApiClient = apiClientBulkDownloadWebhook(apiURL);
  const confirmation = await ossApiClient.callInternalEndpoint({
    cxId: cxId,
    patientId: patientId,
    requestId: requestId,
    dtos: response,
  });
  console.log(`Confirmation: ${JSON.stringify(confirmation)}`);
}

export const DocumentBulkSignerLambdaResponseSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  description: z.string().optional(),
  status: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().optional(),
  url: z.string(),
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
    callInternalEndpoint: async function (params: BulkDownloadWebhookParams) {
      try {
        console.log(`Trigger API on ${sendBulkDownloadUrl} w/ ${JSON.stringify(params)}`);
        await ossApi.post(sendBulkDownloadUrl, params.dtos, {
          params: { cxId: params.cxId, patientId: params.patientId, requestId: params.requestId },
        });
        console.log(`Successfully triggered API on ${sendBulkDownloadUrl}`);
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
