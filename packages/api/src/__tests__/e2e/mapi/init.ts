import { initWebhookServer, tearDownWebhookServer } from "./webhook/webhook-server";

export async function initMapiE2e() {
  await initWebhookServer();
}

export async function tearDownMapiE2e() {
  await tearDownWebhookServer();
}
