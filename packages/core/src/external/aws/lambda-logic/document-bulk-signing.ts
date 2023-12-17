import { S3Utils } from "../s3";
import { DocumentReference } from "@medplum/fhirtypes";
import { searchDocuments } from "../../opensearch/search-documents";
import axios from "axios";
import { capture } from "../../../util/notifications";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { DocumentBulkSignerLambdaResponse } from "../../../domain/document-bulk-signer-response";
const ossApi = axios.create();
dayjs.extend(duration);

const SIGNED_URL_DURATION = dayjs.duration({ minutes: 3 });

export type DocumentBulkSignerLambdaRequest = {
  patientId: string;
  cxId: string;
  requestId: string;
};

export enum MAPIWebhookStatus {
  completed = "completed",
  failed = "failed",
}

export type BulkDownloadWebhookParams = {
  cxId: string;
  patientId: string;
  requestId: string;
  documents?: DocumentBulkSignerLambdaResponse[];
  status: MAPIWebhookStatus;
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
  const ossApiClient = makeApiClientTriggerBulkSignerCompletion(apiURL);
  let status: MAPIWebhookStatus;
  let response: DocumentBulkSignerLambdaResponse[] = [];
  try {
    const urls = await Promise.all(
      documents.map(async doc => {
        // Check if content and attachment exist
        const attachment = doc?.content?.[0]?.attachment;
        if (!attachment) return;

        // Check if fileName is defined
        const fileName = attachment.title;
        if (!fileName) {
          return;
        }

        const signedUrl = await s3Utils.getSignedUrl({
          bucketName,
          fileName,
          durationSeconds: SIGNED_URL_DURATION.asSeconds(),
        });

        return {
          id: doc.id || "",
          fileName: fileName,
          description: doc.description,
          mimeType: attachment.contentType,
          size: attachment.size,
          url: signedUrl,
          status: doc.status,
          indexed: attachment.creation,
          type: doc.type,
        };
      })
    );
    response = urls.flatMap(url => url ?? []);
    status = MAPIWebhookStatus.completed;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const msg = "Error in bulkUrlSigningLambda.getSignedUrls";
    const extra = {
      patientId: patientId,
      context: `bulkUrlSigningLambda.getSignedUrls`,
      error,
    };
    console.log(msg, extra);
    capture.message(msg, { extra, level: "error" });
    status = MAPIWebhookStatus.failed;
  }
  await ossApiClient.callInternalEndpoint({
    cxId,
    patientId,
    requestId,
    documents: status === MAPIWebhookStatus.completed ? response : [],
    status,
  });
}

export function makeApiClientTriggerBulkSignerCompletion(apiURL: string) {
  const sendBulkDownloadUrl = `${apiURL}/internal/docs/bulkSignerCompletion`;

  return {
    callInternalEndpoint: async function (params: BulkDownloadWebhookParams) {
      try {
        await ossApi.post(sendBulkDownloadUrl, params.documents, {
          params: {
            cxId: params.cxId,
            patientId: params.patientId,
            requestId: params.requestId,
            status: params.status,
          },
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
      }
    },
  };
}
