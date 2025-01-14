import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import/setup before all other imports
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "@metriport/shared";
import express, { Application, raw, Request, Response } from "express";
import fs from "fs";
import https from "https";

const app: Application = express();

app.use(express.urlencoded({ extended: false, limit: "2mb" }));

const apiKey = getEnvVarOrFail("METRIPORT_API_KEY");
const webhookKey = getEnvVarOrFail("METRIPORT_WH_KEY");
/******************************************************
 START - Docs section
 ******************************************************/
// const webhookKey = "your_secret_key"; // Webhook key from the Settings page
const metriportApi = new MetriportMedicalApi(apiKey, { sandbox: true });

function verifySignature(req: Request): boolean {
  const signature = String(req.headers["x-metriport-signature"]);
  const payload = req.body; // unparsed, raw body
  if (metriportApi.verifyWebhookSignature(webhookKey, payload, signature)) {
    console.log(`Signature verified`);
    return true;
  } else {
    console.log(`Signature verification failed`);
    return false;
  }
}
/******************************************************
 END - Docs section
 ******************************************************/

app.post("/", raw({ type: "*/*" }), async (req: Request, res: Response) => {
  console.log(`BODY: ${req.body.toString()}`);

  if (!verifySignature(req)) {
    return res.sendStatus(401);
  }

  const payload = JSON.parse(req.body.toString());
  if (payload.meta.type === "medical.document-download") {
    console.log(`Received document download webhook`);
    const patient = payload.patients[0];

    if (patient.status === "completed") {
      const documents = payload.patients[0].documents;

      if (documents.length > 0) {
        const firstDoc = documents[0];

        // DOWNLOAD THE DOCUMENT
        // Expected response https://docs.metriport.com/medical-api/api-reference/document/get-document#response
        const resp = await metriportApi.getDocumentUrl(firstDoc.fileName, "pdf");

        await downloadFile(resp.url, firstDoc.fileName, "pdf");
      }
    } else {
      console.log("Error querying documents");
    }
  }

  if (payload.meta.type === "medical.document-conversion") {
    console.log(`Received document conversion webhook`);
    const patient = payload.patients[0];

    if (patient.status === "completed") {
      const patientId = patient.patientId;

      // START A CONSOLIDATED QUERY
      // Expected response https://docs.metriport.com/medical-api/api-reference/fhir/consolidated-data-query-post#response
      await metriportApi.startConsolidatedQuery(
        patientId,
        [],
        "2021-12-01",
        "2023-12-01",
        undefined
      );
    } else {
      console.log("Error converting documents");
    }
  }

  if (payload.meta.type === "medical.consolidated-data") {
    console.log(`Received consolidated data webhook`);
    const patient = payload.patients[0];

    if (patient.status === "completed") {
      // Process/store the consolidated data
      console.log(JSON.stringify(payload, undefined, 2));
    } else {
      console.log("Error consolidating data");
    }
  }

  if (payload.ping) {
    console.log(`Sending 200 | OK + 'pong' body param`);
    return res.status(200).send({ pong: payload.ping });
  }
  console.log(`Sending 200 | OK`);
  res.sendStatus(200);
});

// If needed, you can parse the body as JSON from here on (the webhook endpoint
// should work with the raw request body)
app.use(express.json({ limit: "2mb" }));

const port = 8088;
app.listen(port, "0.0.0.0", async () => {
  console.log(`[server]: Webhook mock server is running on port ${port}`);
});

async function downloadFile(url: string, fileName: string, conversionType: string) {
  return new Promise(resolve => {
    https.get(url, res => {
      const fileStream = fs.createWriteStream(`./${fileName}.${conversionType}`);
      res.pipe(fileStream);

      fileStream.on("finish", () => {
        fileStream.close();
        console.log("Download finished");
        resolve("success");
      });
    });
  });
}
