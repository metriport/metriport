// This is a helper script that lets you test constructing your own soap+saml requests. It creates the SOAP Envelope and then sends it to to the gateway specified in the request body.
// npm run saml-server and then reference the Metriport- IHE GW / XML + SAML Constructor - Postman collection
import * as dotenv from "dotenv";
dotenv.config();
import { v4 as uuidv4 } from "uuid";
import express from "express";
import { json, Request, Response } from "express";
import { createAndSignBulkXCPDRequests } from "@metriport/core/external/saml/xcpd/iti55-envelope";
import { createAndSignBulkDQRequests } from "@metriport/core/external/saml/xca/iti38-envelope";
import { createAndSignBulkDRRequests } from "@metriport/core/external/saml/xca/iti39-envelope";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { sendSignedRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/saml-client";

const app = express();
const port = 8043;
app.use(json());

const privateKey = getEnvVarOrFail("IHE_STAGING_KEY_ENCRYPTED");
const x509CertPem = getEnvVarOrFail("IHE_STAGING_CERT");
const certChain = getEnvVarOrFail("IHE_STAGING_CERT_CHAIN");
const privateKeyPassword = getEnvVarOrFail("IHE_STAGING_KEY_PASSWORD");

app.post("/xcpd", async (req: Request, res: Response) => {
  if (!req.is("application/json")) {
    return res.status(400).send({ detail: "Invalid content type. Expected 'application/json'." });
  }

  try {
    const xmlResponses = createAndSignBulkXCPDRequests(
      req.body,
      x509CertPem,
      privateKey,
      privateKeyPassword
    );
    const response = await sendSignedRequests({
      signedRequests: xmlResponses,
      certChain,
      publicCert: x509CertPem,
      privateKey,
      privateKeyPassword,
      patientId: uuidv4(),
      cxId: uuidv4(),
    });

    res.type("application/xml").send(response);
  } catch (error) {
    console.log(error);
    res.status(500).send({ detail: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

app.post("/xcadq", async (req: Request, res: Response) => {
  if (!req.is("application/json")) {
    return res.status(400).send({ detail: "Invalid content type. Expected 'application/json'." });
  }

  try {
    const xmlResponses = createAndSignBulkDQRequests({
      bulkBodyData: req.body,
      publicCert: x509CertPem,
      privateKey,
      privateKeyPassword,
    });
    const response = await sendSignedRequests({
      signedRequests: xmlResponses,
      certChain,
      publicCert: x509CertPem,
      privateKey,
      privateKeyPassword,
      patientId: uuidv4(),
      cxId: uuidv4(),
    });

    res.type("application/xml").send(response);
  } catch (error) {
    res.status(500).send({ detail: "Internal Server Error" });
  }
});

app.post("/xcadr", async (req: Request, res: Response) => {
  if (!req.is("application/json")) {
    return res.status(400).send({ detail: "Invalid content type. Expected 'application/json'." });
  }

  try {
    const xmlResponses = createAndSignBulkDRRequests({
      bulkBodyData: req.body,
      publicCert: x509CertPem,
      privateKey,
      privateKeyPassword,
    });
    const response = await sendSignedRequests({
      signedRequests: xmlResponses,
      certChain,
      publicCert: x509CertPem,
      privateKey,
      privateKeyPassword,
      patientId: uuidv4(),
      cxId: uuidv4(),
    });

    res.type("application/xml").send(response);
  } catch (error) {
    res.status(500).send({ detail: "Internal Server Error" });
  }
});
