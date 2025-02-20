import { MetriportMedicalApi } from "@metriport/api-sdk";
import {
  DocumentBulkDownloadWebhookRequest,
  DocumentConversionWebhookRequest,
  DocumentDownloadWebhookRequest,
  isConsolidatedWebhookRequest,
  isDocumentBulkDownloadWebhookRequest,
  isDocumentConversionWebhookRequest,
  isDocumentDownloadWebhookRequest,
  isPingWebhookRequest,
} from "@metriport/shared/medical";
import { Request, Response } from "express";
import { SIGNATURE_HEADER_NAME } from "../../../../routes/header";
import { handleConsolidated } from "./consolidated";
import { handlePing } from "./settings";

let whKey: string | undefined = undefined;

export async function handleRequest(req: Request, res: Response) {
  try {
    if (!isSignatureValid(req)) {
      console.log(`[WH] ====> Signature verification failed`);
      throw new Error("Signature verification failed");
    }
    const body = JSON.parse(req.body);
    console.log(`[WH] ========> Handling request... type: ${body?.meta?.type}`);
    const whRequest = MetriportMedicalApi.parseWebhookResponse(body);
    if (isPingWebhookRequest(whRequest)) {
      return handlePing(whRequest, res);
    }
    if (isConsolidatedWebhookRequest(whRequest)) {
      return handleConsolidated(whRequest, res);
    }
    if (isDocumentConversionWebhookRequest(whRequest)) {
      return handleDocConversion(whRequest, res);
    }
    if (isDocumentDownloadWebhookRequest(whRequest)) {
      return handleDocDownload(whRequest, res);
    }
    if (isDocumentBulkDownloadWebhookRequest(whRequest)) {
      return handleBulkDownloadUrls(whRequest, res);
    }
    return res.status(400).send({ message: `Invalid WH` });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.log(`[WH] ######> ERROR parsing WH request - cause: ${error.cause} - error: ${error}`);
    return res.status(400).send({ message: error.message });
  }
}

function handleDocConversion(whRequest: DocumentConversionWebhookRequest, res: Response) {
  return res.sendStatus(200);
}

function handleDocDownload(whRequest: DocumentDownloadWebhookRequest, res: Response) {
  return res.sendStatus(200);
}

function handleBulkDownloadUrls(whRequest: DocumentBulkDownloadWebhookRequest, res: Response) {
  return res.sendStatus(200);
}

export function storeWebhookKey(key: string | undefined | null): void {
  whKey = key ?? undefined;
}

function isSignatureValid(req: Request): boolean {
  if (!whKey) throw new Error("Webhook key not set");
  const signature = req.headers[SIGNATURE_HEADER_NAME];
  return MetriportMedicalApi.verifyWebhookSignature(whKey, req.body, String(signature));
}

export default {
  handleRequest,
  storeWebhookKey,
};
