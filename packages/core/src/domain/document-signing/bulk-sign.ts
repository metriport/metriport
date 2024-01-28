import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { DocumentReference } from "@medplum/fhirtypes";
import { capture } from "../../util/capture";
import { S3Utils } from "../../external/aws/s3";
import { DocumentFromBulkSignerLambda } from "./document-bulk-signer-response";
import { searchDocuments } from "../../external/fhir/document/search-documents";

const ossApi = axios.create();
dayjs.extend(duration);

const SIGNED_URL_DURATION = dayjs.duration({ minutes: 3 });

export type BulkDownloadWebhookParams = {
  cxId: string;
  patientId: string;
  requestId: string;
  documents?: DocumentFromBulkSignerLambda[];
};

// Proposed fix with const, no let, try/catch, and sending error to callInternalEndpoint
export async function signUrlsAndSendToApi(
  cxId: string,
  patientId: string,
  requestId: string,
  bucketName: string,
  region: string,
  apiURL: string
): Promise<void> {
  const s3Utils = new S3Utils(region);
  const ossApiClient = makeApiClientTriggerBulkSignerCompletion(apiURL);
  try {
    const documents: DocumentReference[] = await searchDocuments({ cxId, patientId });
    const documentsAndUrl: DocumentFromBulkSignerLambda[] = await processDocuments(
      documents,
      s3Utils,
      bucketName
    );

    await ossApiClient.callInternalEndpoint({
      cxId,
      patientId,
      requestId,
      documents: documentsAndUrl,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const msg = "Error in bulkUrlSigningLambda.signUrlsAndSendToApi";
    const extra = {
      patientId: patientId,
      context: `bulkUrlSigningLambda.signUrlsAndSendToApi`,
      error,
    };
    console.log(`${msg}, ${JSON.stringify(extra)}`);
    capture.message(msg, { extra, level: "error" });
    await ossApiClient.callInternalEndpoint({
      cxId,
      patientId,
      requestId,
      documents: [],
    });
  }
}

async function processDocuments(
  documents: DocumentReference[],
  s3Utils: S3Utils,
  bucketName: string
): Promise<DocumentFromBulkSignerLambda[]> {
  const results = await Promise.all(
    documents.map(async doc => {
      const attachment = doc?.content?.[0]?.attachment;
      if (!attachment || !attachment.title) return undefined;

      const fileName = attachment.title;
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
  return results.flatMap(d => d ?? []);
}

export function makeApiClientTriggerBulkSignerCompletion(apiURL: string) {
  const sendBulkDownloadUrl = `${apiURL}/internal/docs/bulk-signer-completion`;

  return {
    callInternalEndpoint: async function (params: BulkDownloadWebhookParams) {
      try {
        await ossApi.post(sendBulkDownloadUrl, params.documents, {
          params: {
            cxId: params.cxId,
            patientId: params.patientId,
            requestId: params.requestId,
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
        console.log(`${msg}, ${JSON.stringify(extra)}`);
        capture.message(msg, { extra, level: "info" });
      }
    },
  };
}
