import ngrok, { Session } from "@ngrok/ngrok";
import express, { Request, Response } from "express";
import { Server } from "http";
import { handleRequest } from "./webhook-handler";

const port = 8478;
const app = express();

app.get("/", async (req: Request, res: Response) => {
  await handleRequest(req, res);
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
  server = app.listen(port, () => {
    console.log(`Webhook server listening at port ${port}`);
  });
  const ngrokAuthToken = process.env.NGROK_AUTHTOKEN;
  if (!ngrokAuthToken) throw new Error("NGROK_AUTHTOKEN env var not found");
  session = await new ngrok.SessionBuilder().authtoken(ngrokAuthToken).connect();
  const listener = await session.httpEndpoint().listen();
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

if (require.main === module) {
  initWebhookServer();
}
