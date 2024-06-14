import { PingWebhookRequest } from "@metriport/shared/src/medical/webhook/webhook-request";
import { Response } from "express";

let webhookRequest: PingWebhookRequest | undefined = undefined;

export function getPingWebhookRequest(): PingWebhookRequest | undefined {
  return webhookRequest;
}

export function resetPingData(value: PingWebhookRequest | undefined = undefined): void {
  webhookRequest = value;
}

export function handlePing(whRequest: PingWebhookRequest, res: Response) {
  console.log(`[WH] ================> Handle Ping WH running... ping: ${whRequest.ping}`);
  webhookRequest = whRequest;
  return res.status(200).send({ pong: whRequest.ping });
}
