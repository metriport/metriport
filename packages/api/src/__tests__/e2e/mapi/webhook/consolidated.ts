import { ConsolidatedWebhookRequest } from "@metriport/shared/medical";
import { Response } from "express";

let webhookRequest: ConsolidatedWebhookRequest | undefined = undefined;

export function getConsolidatedWebhookRequest(): ConsolidatedWebhookRequest | undefined {
  return webhookRequest;
}

export function resetConsolidatedData(
  value: ConsolidatedWebhookRequest | undefined = undefined
): void {
  webhookRequest = value;
}

export function handleConsolidated(whRequest: ConsolidatedWebhookRequest, res: Response) {
  console.log(
    `[WH] ================> Handle Consolidated WH running... whRequest: ${
      whRequest ? whRequest.patients?.length + " patients" : whRequest
    }`
  );
  webhookRequest = whRequest;
  return res.sendStatus(200);
}
