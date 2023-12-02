import * as dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import https from "https";
import { MetriportMedicalApi } from "@metriport/api-sdk";
import express, { Application, Request, Response } from "express";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";

const app: Application = express();

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false, limit: "2mb" }));

const whKey = getEnvVarOrFail("METRIPORT_WH_KEY");
const apiKey = getEnvVarOrFail("METRIPORT_API_KEY");
const isProd = getEnvVarOrFail("IS_PROD") === "true";

const metriportApi = new MetriportMedicalApi(apiKey, {
  baseAddress: isProd ? "https://api.metriport.com" : "https://api.sandbox.metriport.com",
});

app.post("/", async (req: Request, res: Response) => {
  console.log(`BODY: ${JSON.stringify(req.body, undefined, 2)}`);

  const signature = req.headers["x-metriport-signature"];

  if (metriportApi.verifyWebhookSignature(whKey, req.body, String(signature))) {
    console.log(`Signature verified`);
  } else {
    console.log(`Signature verification failed`);
  }

  if (req.body.meta.type === "medical.document-download") {
    console.log(`Received document download webhook`);
    const patient = req.body.patients[0];

    if (patient.status === "completed") {
      const documents = req.body.patients[0].documents;

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

  if (req.body.meta.type === "medical.document-conversion") {
    console.log(`Received document conversion webhook`);
    const patient = req.body.patients[0];

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

  if (req.body.meta.type === "medical.consolidated-data") {
    console.log(`Received consolidated data webhook`);
    const patient = req.body.patients[0];

    if (patient.status === "completed") {
      console.log(JSON.stringify(req.body, undefined, 2));
    } else {
      console.log("Error consolidating data");
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

async function downloadFile(url: string, fileName: string, conversionType: string) {
  return new Promise((resolve, reject) => {
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
