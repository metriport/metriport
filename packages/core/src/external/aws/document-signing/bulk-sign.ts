import {
  executeWithNetworkRetries,
  getNetworkErrorDetails,
  MetriportError,
} from "@metriport/shared";
import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { searchDocuments } from "../../../command/consolidated/search/document-reference/search";
import { S3Utils } from "../s3";
import { DocumentBulkSignerLambdaResponse } from "./document-bulk-signer-response";

dayjs.extend(duration);

const ossApi = axios.create();
const SIGNED_URL_DURATION_SECONDS = dayjs.duration({ minutes: 10 }).asSeconds();

export type DocumentBulkSignerLambdaRequest = {
  patientId: string;
  cxId: string;
  requestId: string;
};

export async function searchDocumentsSignUrlsAndSendToApi(
  cxId: string,
  patientId: string,
  requestId: string,
  bucketName: string,
  region: string,
  apiURL: string
) {
  const s3Utils = new S3Utils(region);
  const { log } = out("getSignedUrls");

  const documents = await searchDocuments({ cxId, patientId });
  const ossApiClient = apiClientBulkDownloadWebhook(apiURL);

  try {
    const urls = await Promise.all(
      documents.flatMap(async doc => {
        const attachment = (doc?.content ?? [])
          .map(content => content?.attachment)
          .find(attachment => attachment?.title !== undefined);

        const fileName = attachment?.title;
        if (!fileName) {
          const msg = `Found document without attachment title (filename)`;
          const extra = { cxId, patientId, requestId, doc };
          log(`${msg} - ${JSON.stringify(extra)}`);
          capture.message(msg, { extra, level: "warning" });
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
          status: doc.status,
          indexed: attachment.creation,
          type: doc.type,
        };
      })
    );

    const response = urls.flatMap(url => (url !== undefined ? url : []));

    await ossApiClient.callInternalEndpoint({
      cxId,
      patientId,
      requestId,
      docs: response,
      status: "completed",
    });
  } catch (error) {
    const msg = "Error getting signed URLs";
    const extra = { ...getNetworkErrorDetails(error), cxId, patientId, requestId };
    log(`${msg} - ${JSON.stringify(extra)}`);
    capture.error(msg, {
      extra: { ...extra, context: `getSignedUrls`, error },
    });
    await ossApiClient.callInternalEndpoint({
      cxId,
      patientId,
      requestId,
      docs: [],
      status: "failed",
    });
  }
}

export type BulkDownloadWebhookParams = {
  cxId: string;
  patientId: string;
  requestId: string;
  docs: DocumentBulkSignerLambdaResponse[];
  status: string;
};

export function apiClientBulkDownloadWebhook(apiURL: string) {
  const { log } = out("apiClientBulkDownloadWebhook");
  const sendBulkDownloadUrl = `${apiURL}/internal/docs/triggerBulkDownloadWebhook`;

  return {
    callInternalEndpoint: async function (params: BulkDownloadWebhookParams) {
      try {
        await executeWithNetworkRetries(() =>
          ossApi.post(sendBulkDownloadUrl, params.docs, {
            params: {
              cxId: params.cxId,
              patientId: params.patientId,
              requestId: params.requestId,
              status: params.status,
            },
          })
        );
      } catch (error) {
        const msg = "Error notifying API on bulk-sign";
        const extra = { ...getNetworkErrorDetails(error), url: sendBulkDownloadUrl };
        log(`${msg} - ${JSON.stringify(extra)}`);
        capture.message(msg, { extra: { ...extra, params, error }, level: "info" });
        throw new MetriportError(msg, error, extra);
      }
    },
  };
}
