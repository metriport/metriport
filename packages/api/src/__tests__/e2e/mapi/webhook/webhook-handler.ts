import { MetriportMedicalApi } from "@metriport/api-sdk";
import {
  DocumentBulkDownloadWebhookRequest,
  DocumentConversionWebhookRequest,
  DocumentDownloadWebhookRequest,
  isConsolidatedWebhookRequest,
  isDocumentBulkDownloadWebhookRequest,
  isDocumentConversionWebhookRequest,
  isDocumentDownloadWebhookRequest,
} from "@metriport/shared/medical";
import { Request, Response } from "express";
import { handleConsolidated } from "./consolidated";

let whKey: string | undefined = undefined;

export async function handleRequest(req: Request, res: Response) {
  try {
    if (!isSignatureValid(req)) {
      console.log(`[WH] ====> Signature verification failed`);
      throw new Error("Signature verification failed");
    }
    console.log(`[WH] ========> Handling request... type: ${req.body?.meta?.type}`);
    const whRequest = MetriportMedicalApi.parseWebhookResponse(req.body);
    if (whRequest.meta.type === "ping") {
      return handlePing(req, res);
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
    return res.status(400).send({ message: `Invalid WH type: ${whRequest.meta.type}` });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.log(`[WH] ====> Error parsing WH request: ${JSON.stringify(error.cause)}`);
    return res.status(400).send({ message: error.message });
  }
}

function handlePing(req: Request, res: Response) {
  return res.status(200).send({ pong: req.body.ping });
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
  const signature = req.headers["x-metriport-signature"];
  return MetriportMedicalApi.verifyWebhookSignature(whKey, req.body, String(signature));
}

export default {
  handleRequest,
  storeWebhookKey,
};
