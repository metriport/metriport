import * as dotenv from "dotenv";
dotenv.config();
// keep dotenv.config() at the top of the file
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import express, { Application, Request, Response } from "express";

const app: Application = express();

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false, limit: "2mb" }));

const whKey = getEnvVarOrFail("WH_KEY");
const apiKey = getEnvVarOrFail("API_KEY");
const apiUrl = getEnvVarOrFail("API_URL");

function mockDownload(name: string) {
  // Here you can simulate a download by making a GET request to the URL
  console.log(`Downloaded file: ${name}`);
}

const metriportApi = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
});

app.post("/", async (req: Request, res: Response) => {
  console.log(`BODY: ${JSON.stringify(req.body, undefined, 2)}`);

  const signature = req.headers["x-metriport-signature"];

  if (metriportApi.verifyWebhookSignature(whKey, req.body, String(signature))) {
    console.log(`Signature verified`);
  } else {
    console.log(`Signature verification failed`);
  }

  if (req.body.meta && req.body.meta.type === "medical.document-bulk-download-urls") {
    for (const patient of req.body.patients) {
      for (const document of patient.documents) {
        mockDownload(document.fileName);
      }
    }
  }

  if (req.body.ping) {
    console.log(`Sending 200 | OK + 'pong' body param`);
    return res.status(200).send({ pong: req.body.ping });
  }
  console.log(`Sending 200 | OK`);
  res.sendStatus(200);
});

const port = 8088;
app.listen(port, "0.0.0.0", async () => {
  console.log(`[server]: Webhook mock server is running on port ${8088}`);
});
