import express from "express";
import { json, Request, Response } from "express";
import axios from "axios";
import fs from "fs";
import https from "https";

import { createAndSignXCPDRequest } from "@metriport/core/external/carequality/saml/xcpd/envelope";
import { createAndSignDQRequest } from "@metriport/core/external/carequality/saml/xca/iti38-envelope";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";

import * as dotenv from "dotenv";
dotenv.config();

const app = express();
const port = 8043;
app.use(json());

const privateKey = getEnvVarOrFail("IHE_STAGING_KEY");
const x509CertPem = getEnvVarOrFail("IHE_STAGING_CERT");

app.post("/xcpd", async (req: Request, res: Response) => {
  if (!req.is("application/json")) {
    return res.status(400).send({ detail: "Invalid content type. Expected 'application/json'." });
  }

  try {
    const xmlString = await createAndSignXCPDRequest(req.body, x509CertPem, privateKey);
    fs.writeFileSync("./temp.xml", xmlString);
    const response = await sendSignedXml(xmlString, req.body.gateway.url);

    res.type("application/xml").send(response);
  } catch (error) {
    res.status(500).send({ detail: "Internal Server Error" });
  }
});

app.post("/xcadq", async (req: Request, res: Response) => {
  if (!req.is("application/json")) {
    return res.status(400).send({ detail: "Invalid content type. Expected 'application/json'." });
  }

  try {
    const xmlString = await createAndSignDQRequest(req.body, x509CertPem, privateKey);
    fs.writeFileSync("./temp.xml", xmlString);
    const response = await sendSignedXml(xmlString, req.body.gateway.url);

    res.type("application/xml").send(response);
  } catch (error) {
    res.status(500).send({ detail: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

async function sendSignedXml(signedXml: string, url: string): Promise<string> {
  const certFilePath = "./tempCert.pem";
  const keyFilePath = "./tempKey.pem";
  fs.writeFileSync(certFilePath, x509CertPem);
  fs.writeFileSync(keyFilePath, privateKey);

  try {
    const agent = new https.Agent({
      rejectUnauthorized: false,
      cert: fs.readFileSync(certFilePath),
      key: fs.readFileSync(keyFilePath),
    });

    const response = await axios.post(url, signedXml, {
      headers: {
        "Content-Type": "application/soap+xml;charset=UTF-8",
        "Cache-Control": "no-cache",
      },
      httpsAgent: agent,
    });

    return response.data;
  } finally {
    fs.unlinkSync(certFilePath);
    fs.unlinkSync(keyFilePath);
  }
}
