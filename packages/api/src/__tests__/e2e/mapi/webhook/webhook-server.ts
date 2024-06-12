import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else.
import { getEnvVar, getEnvVarOrFail, sleep } from "@metriport/shared";
import ngrok, { Session } from "@ngrok/ngrok";
import express, { Request, Response } from "express";
import { Server } from "http";
import whHandler from "./webhook-handler";

const port = 8478;

const app = express();
app.use(express.json({ limit: "20mb" }));

app.post("/", async (req: Request, res: Response) => {
  await whHandler.handleRequest(req, res);
});

let server: Server;
let session: Session;
let webhookServerUrl: string | undefined;

export function getWebhookServerUrl() {
  if (!webhookServerUrl) {
    throw new Error("Webhook server not initialized");
  }
  return webhookServerUrl;
}

export async function initWebhookServer() {
  const ngrokAuthToken = getEnvVarOrFail("NGROK_AUTHTOKEN");
  const customDomain = getEnvVar("NGROK_CUSTOM_DOMAIN");
  // Allows to run this as a standalone script with ts-node-dev for hot reloading (otherwise Ngrok
  // complains about multiple connections)
  await sleep(1_000);
  server = app.listen(port, () => {
    console.log(`Webhook server listening at port ${port}`);
  });
  session = await new ngrok.SessionBuilder().authtoken(ngrokAuthToken).connect();
  let listenerBuilder = session.httpEndpoint();
  if (customDomain) listenerBuilder = listenerBuilder.domain(customDomain);
  const listener = await listenerBuilder.listen();
  listener.forward(`localhost:${port}`);
  webhookServerUrl = listener.url() ?? undefined;
  console.log(`Webhook server external address: ${webhookServerUrl}`);
}

export async function tearDownWebhookServer() {
  console.log(`Tearing down webhook server...`);
  await ngrok.disconnect();
  await ngrok.kill();
  await session.close();
  server.closeAllConnections();

  let serverClosed: (value?: unknown) => void;
  const setResolve = (resolve: (value?: unknown) => void) => {
    serverClosed = resolve;
  };
  const promise = new Promise(resolve => setResolve(resolve));
  server.close(err => {
    if (err) console.error(err);
    serverClosed();
  });
  return promise;
}

export function storeWebhookKey(key: string | undefined | null): void {
  whHandler.storeWebhookKey(key);
}

// If this file is run directly, start the webhook server. Useful for testing.
if (require.main === module) {
  initWebhookServer();
  const whKey = getEnvVarOrFail("WH_KEY");
  storeWebhookKey(whKey);
}

export default {
  initWebhookServer,
  tearDownWebhookServer,
  getWebhookServerUrl,
  storeWebhookKey,
};
